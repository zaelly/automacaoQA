/**
 * agentRoutes — REST API + WebSocket broadcast for AI agent sessions.
 *
 * POST /api/agent/sessions        — start a new agent session
 * GET  /api/agent/sessions        — list all sessions
 * GET  /api/agent/sessions/:id    — get session by ID
 * GET  /api/agent/sessions/:id/report — serve HTML report
 * GET  /api/agent/sessions/:id/video  — serve session video
 * DELETE /api/agent/sessions/:id  — delete session
 */

import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

import { AgentExecutor } from '../agent/AgentExecutor';
import { SessionStorage } from '../storage/SessionStorage';
import { HtmlReporter } from '../reports/HtmlReporter';
import type { BroadcastEvent } from '../agent/types';

const WORKSPACE = path.join(__dirname, '..', 'agent-workspace');
const storage = new SessionStorage(WORKSPACE);
const reporter = new HtmlReporter();

// Track active executors so we can abort them
const activeSessions = new Map<string, AgentExecutor>();

export function createAgentRouter(broadcast: (event: BroadcastEvent) => void): Router {
  const router = Router();

  // POST /api/agent/sessions — start a session
  router.post('/sessions', async (req: Request, res: Response) => {
    const { goal, baseUrl, config } = req.body;

    if (!goal) return res.status(400).json({ error: 'goal is required' });
    if (!baseUrl) return res.status(400).json({ error: 'baseUrl is required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });

    const sessionId = uuidv4();

    const executor = new AgentExecutor({
      sessionId,
      goal,
      baseUrl,
      config: config || {},
      workspaceRoot: WORKSPACE,
      geminiApiKey: apiKey,
      broadcast,
    });

    activeSessions.set(sessionId, executor);

    // Start in background — return sessionId immediately
    executor.run()
      .then(session => {
        // Generate HTML report when done
        const reportPath = storage.getReportPath(sessionId);
        reporter.generate(session, reportPath);
        session.reportPath = reportPath;
        storage.save(session);
        activeSessions.delete(sessionId);
      })
      .catch(err => {
        console.error(`[AgentSession ${sessionId}] fatal:`, err.message);
        activeSessions.delete(sessionId);
      });

    return res.status(202).json({ sessionId, status: 'started' });
  });

  // GET /api/agent/sessions — list all
  router.get('/sessions', (_req: Request, res: Response) => {
    const sessions = storage.listAll().map(s => ({
      id: s.id,
      goal: s.goal,
      baseUrl: s.baseUrl,
      status: s.status,
      score: s.score,
      passedSteps: s.passedSteps,
      failedSteps: s.failedSteps,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
    }));

    // Also include any actively running sessions not yet saved
    activeSessions.forEach((exec, id) => {
      if (!sessions.find(s => s.id === id)) {
        const s = exec.getSession();
        sessions.unshift({
          id: s.id,
          goal: s.goal,
          baseUrl: s.baseUrl,
          status: s.status,
          score: s.score,
          passedSteps: s.passedSteps,
          failedSteps: s.failedSteps,
          startedAt: s.startedAt,
          finishedAt: s.finishedAt,
        });
      }
    });

    return res.json(sessions);
  });

  // GET /api/agent/sessions/:id
  router.get('/sessions/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);

    // Check active first (fresher data)
    const active = activeSessions.get(id);
    if (active) {
      return res.json(active.getSession());
    }

    const session = storage.load(id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    return res.json(session);
  });

  // GET /api/agent/sessions/:id/report
  router.get('/sessions/:id/report', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const reportPath = storage.getReportPath(id);

    if (!fs.existsSync(reportPath)) {
      return res.status(404).json({ error: 'Report not generated yet' });
    }

    return res.sendFile(reportPath);
  });

  // GET /api/agent/sessions/:id/video
  router.get('/sessions/:id/video', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const videoPath = storage.getVideoPath(id);

    if (!videoPath || !fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Video not found' });
    }

    return res.sendFile(videoPath);
  });

  // DELETE /api/agent/sessions/:id
  router.delete('/sessions/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);

    if (activeSessions.has(id)) {
      return res.status(409).json({ error: 'Session is still running' });
    }

    const deleted = storage.delete(id);
    if (!deleted) return res.status(404).json({ error: 'Session not found' });

    return res.json({ deleted: true });
  });

  return router;
}
