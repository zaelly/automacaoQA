/**
 * agentRoutes — REST API for QA agent sessions.
 *
 * Flow for POST /api/agent/sessions:
 *   1. TestRunner runs ALL Playwright checks (no AI in the loop)
 *   2. ONE Groq call analyzes the collected evidence
 *   3. Results saved to Supabase + disk
 *
 * POST   /api/agent/sessions         — start a new session
 * GET    /api/agent/sessions         — list all sessions
 * GET    /api/agent/sessions/:id     — get session by ID
 * DELETE /api/agent/sessions/:id     — delete session
 */

import { Router, Request, Response } from 'express';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { TestRunner } from '../agent/TestRunner';
import { GroqClient } from '../llm/GroqClient';
import { IntentDetector } from '../llm/IntentDetector';
import { INTENTS } from '../agent/intents';
import { QaSessionStorage } from '../storage/QaSessionStorage';
import type { BroadcastEvent, QaSession } from '../agent/types';

const WORKSPACE = path.join(__dirname, '..', 'agent-workspace');
const storage   = new QaSessionStorage(WORKSPACE);

// Active sessions tracked in memory for live status
const activeSessions = new Map<string, QaSession>();

export function createAgentRouter(broadcast: (event: BroadcastEvent) => void): Router {
  const router = Router();

  // ── POST /detect-intent ─────────────────────────────────────────────────────
  router.post('/detect-intent', async (req: Request, res: Response) => {
    const { goal } = req.body as { goal?: string };
    if (!goal) return res.status(400).json({ error: 'goal é obrigatório' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.json({ intent: 'exploratorio', confidence: 'low', needsClarification: false, intentData: INTENTS.exploratorio });
    }

    try {
      const detector = new IntentDetector(apiKey);
      const result   = await detector.detect(goal);
      const intentData = result.intent !== 'unknown' ? INTENTS[result.intent as keyof typeof INTENTS] : null;
      return res.json({ ...result, intentData, allIntents: Object.values(INTENTS).map(i => ({ id: i.id, name: i.name, emoji: i.emoji, description: i.description })) });
    } catch {
      return res.json({ intent: 'exploratorio', confidence: 'low', needsClarification: false, intentData: INTENTS.exploratorio });
    }
  });

  // ── POST /sessions ──────────────────────────────────────────────────────────
  router.post('/sessions', async (req: Request, res: Response) => {
    const { goal, baseUrl, credentials, intent } = req.body as {
      goal: string;
      baseUrl: string;
      credentials?: { username?: string; password?: string };
      intent?: string;
    };

    if (!goal || !baseUrl) {
      return res.status(400).json({ error: '"goal" e "baseUrl" são obrigatórios' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY não configurado no servidor' });
    }

    const sessionId = uuidv4();

    const intentDef = intent ? INTENTS[intent as keyof typeof INTENTS] : undefined;
    const session: QaSession = {
      id: sessionId,
      goal,
      baseUrl,
      status: 'running',
      intent:      intentDef?.id,
      intentName:  intentDef?.name,
      startedAt: new Date().toISOString(),
    };

    activeSessions.set(sessionId, session);
    broadcast({ type: 'session_started', sessionId, payload: { goal, baseUrl } });

    // Run in background
    runSession(session, apiKey, broadcast, credentials, intent).catch(err => {
      console.error(`[AgentRoute] Session ${sessionId} fatal:`, err.message);
    });

    return res.status(202).json({ sessionId, status: 'started' });
  });

  // ── GET /sessions ───────────────────────────────────────────────────────────
  router.get('/sessions', async (_req: Request, res: Response) => {
    const saved = await storage.list();

    // Merge active (in-memory) sessions at the top
    const active = Array.from(activeSessions.values());
    const savedIds = new Set(saved.map(s => s.id));
    const merged = [
      ...active.filter(s => !savedIds.has(s.id)).map(summarize),
      ...saved.map(summarize),
    ];

    return res.json(merged);
  });

  // ── GET /sessions/:id ───────────────────────────────────────────────────────
  router.get('/sessions/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);

    // Live session first (fresher)
    const live = activeSessions.get(id);
    if (live) return res.json(live);

    const session = await storage.load(id);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

    return res.json(session);
  });

  // ── DELETE /sessions/:id ────────────────────────────────────────────────────
  router.delete('/sessions/:id', async (req: Request, res: Response) => {
    const id = String(req.params.id);

    if (activeSessions.has(id)) {
      return res.status(409).json({ error: 'Sessão ainda em execução' });
    }

    const deleted = await storage.delete(id);
    if (!deleted) return res.status(404).json({ error: 'Sessão não encontrada' });

    return res.json({ deleted: true });
  });

  return router;
}

// ─── Background session runner ────────────────────────────────────────────────

async function runSession(
  session: QaSession,
  groqApiKey: string,
  broadcast: (event: BroadcastEvent) => void,
  credentials?: { username?: string; password?: string },
  intent?: string,
): Promise<void> {
  const { id: sessionId, goal, baseUrl } = session;

  try {
    // ── Phase 1: Playwright audit ─────────────────────────────────────────────
    const runner = new TestRunner(sessionId, WORKSPACE, broadcast);
    const summary = await runner.run(goal, baseUrl, credentials, intent);

    session.testSummary = summary;

    // ── Phase 2: Groq analysis ────────────────────────────────────────────────
    session.status = 'analyzing';
    broadcast({
      type: 'phase_change',
      sessionId,
      payload: {
        phase: 'analyzing',
        label: 'Analisando com Groq AI...',
        stats: {
          total: summary.totalChecks,
          passed: summary.passed,
          failed: summary.failed,
          warnings: summary.warnings,
        },
      },
    });

    const groq = new GroqClient(groqApiKey);
    const report = await groq.analyzeTestResults(summary);

    session.report     = report;
    session.status     = 'completed';
    session.finishedAt = new Date().toISOString();

    broadcast({
      type: 'report_ready',
      sessionId,
      payload: { report, summary },
    });

    await storage.save(session);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    session.status     = 'failed';
    session.error      = msg;
    session.finishedAt = new Date().toISOString();

    broadcast({ type: 'session_error', sessionId, payload: { error: msg } });
    await storage.save(session).catch(() => {});
  } finally {
    activeSessions.delete(sessionId);
  }
}

// Trim heavy fields for list views
function summarize(s: QaSession) {
  return {
    id:           s.id,
    goal:         s.goal,
    baseUrl:      s.baseUrl,
    status:       s.status,
    overallScore: s.report?.overallScore,
    findingsCount: s.report?.findings?.length ?? 0,
    passed:       s.testSummary?.passed,
    failed:       s.testSummary?.failed,
    warnings:     s.testSummary?.warnings,
    startedAt:    s.startedAt,
    finishedAt:   s.finishedAt,
    error:        s.error,
  };
}
