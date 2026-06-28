/**
 * AgentExecutor — THE main agent loop.
 *
 * Orchestrates all modules to run a complete AI-driven QA session:
 *
 *   while (not finished) {
 *     1. Collect page context (screenshot + HTML + a11y + errors)
 *     2. Ask Gemini what to do next (decide)
 *     3. Execute the action via ActionExecutor
 *     4. Take a screenshot
 *     5. Record the step
 *     6. Broadcast the event to WebSocket clients
 *     7. Check for loop / max-steps
 *   }
 *
 * This is the only file that wires everything together.
 */

import * as path from 'path';
import * as fs from 'fs';
import type { WebSocket } from 'ws';

import { BrowserManager } from '../playwright/BrowserManager';
import { PageAnalyzer } from '../playwright/PageAnalyzer';
import { ActionExecutor } from '../playwright/ActionExecutor';
import { AutoHealer } from '../playwright/AutoHealer';
import { GeminiClient } from '../llm/GeminiClient';
import { AgentMemory } from './AgentMemory';
import { NetworkMonitor } from '../tools/NetworkMonitor';
import { ConsoleMonitor } from '../tools/ConsoleMonitor';
import { ScreenshotManager } from '../tools/ScreenshotManager';
import { PerformanceCollector } from '../tools/PerformanceCollector';

import type {
  AgentSession,
  AgentConfig,
  StepRecord,
  BroadcastEvent,
  AgentDecision,
  ActionResult,
} from './types';

export interface AgentExecutorOptions {
  sessionId: string;
  goal: string;
  baseUrl: string;
  config?: Partial<AgentConfig>;
  workspaceRoot: string;
  geminiApiKey: string;
  broadcast?: (event: BroadcastEvent) => void;
}

const DEFAULT_CONFIG: AgentConfig = {
  maxSteps: 50,
  headless: true,
  timeout: 30000,
  screenshotOnEveryStep: true,
  videoEnabled: true,
  viewport: { width: 1366, height: 768 },
};

export class AgentExecutor {
  private session!: AgentSession;
  private browser!: BrowserManager;
  private gemini!: GeminiClient;
  private memory!: AgentMemory;
  private networkMonitor!: NetworkMonitor;
  private consoleMonitor!: ConsoleMonitor;
  private screenshotManager!: ScreenshotManager;
  private perfCollector!: PerformanceCollector;
  private pageAnalyzer!: PageAnalyzer;
  private actionExecutor!: ActionExecutor;
  private sessionWorkspace!: string;
  private opts: AgentExecutorOptions;

  constructor(opts: AgentExecutorOptions) {
    this.opts = opts;
  }

  async run(): Promise<AgentSession> {
    this.init();

    this.emit({ type: 'session_started', sessionId: this.session.id, payload: { goal: this.session.goal, baseUrl: this.session.baseUrl } });

    try {
      // Launch browser
      await this.browser.launch(this.session.config, this.sessionWorkspace);

      const page = this.browser.getPage();

      // Attach monitors
      this.networkMonitor = new NetworkMonitor(page);
      this.consoleMonitor = new ConsoleMonitor(page);
      this.screenshotManager = new ScreenshotManager(page, this.sessionWorkspace);
      this.perfCollector = new PerformanceCollector(page);
      this.pageAnalyzer = new PageAnalyzer(page);

      this.networkMonitor.attach();
      this.consoleMonitor.attach();
      this.perfCollector.attach();

      this.actionExecutor = new ActionExecutor(
        page,
        this.sessionWorkspace,
        (target, html, screenshot) => this.gemini.healSelector(target, html, screenshot),
      );

      // Create test plan
      this.emit({ type: 'planning', sessionId: this.session.id, payload: {} });
      const planResult = await this.gemini.plan(this.session.goal, this.session.baseUrl).catch(() => ({
        plan: [`Test: ${this.session.goal}`],
        estimatedActions: 10,
        riskAreas: [],
      }));

      this.session.plan = planResult.plan;
      this.emit({ type: 'plan_ready', sessionId: this.session.id, payload: { plan: planResult.plan } });

      // Navigate to base URL first
      await page.goto(this.session.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        .catch(() => {});

      // Main agent loop
      await this.agentLoop();

      this.session.status = 'completed';
    } catch (err: any) {
      this.session.status = 'failed';
      this.session.error = err.message;
      this.emit({ type: 'session_error', sessionId: this.session.id, payload: { error: err.message } });
    } finally {
      const videoPath = await this.browser.close();
      if (videoPath) this.session.videoPath = videoPath;

      this.session.finishedAt = new Date().toISOString();
      this.computeScore();
      this.saveSession();

      this.emit({ type: 'session_finished', sessionId: this.session.id, payload: { session: this.session } });
    }

    return this.session;
  }

  private async agentLoop(): Promise<void> {
    const maxSteps = this.session.config.maxSteps;
    let previousError: string | undefined;

    while (this.memory.getStepCount() < maxSteps) {
      const stepNumber = this.memory.getStepCount() + 1;

      // Collect page context
      const pageCtx = await this.pageAnalyzer.getContext(true);
      pageCtx.consoleErrors = this.consoleMonitor.getErrors();
      pageCtx.jsErrors = this.consoleMonitor.getJsErrors();
      pageCtx.networkErrors = this.networkMonitor.getErrors();
      pageCtx.performance = this.perfCollector.getCurrent();

      this.emit({ type: 'page_analyzed', sessionId: this.session.id, payload: { url: pageCtx.url, title: pageCtx.title, step: stepNumber } });

      // Ask Gemini for next action
      let decision: AgentDecision;
      try {
        decision = await this.gemini.decide(
          this.session.goal,
          pageCtx,
          this.memory.getHistory(),
          previousError,
        );
      } catch (err: any) {
        this.session.error = `Gemini error: ${err.message}`;
        break;
      }

      this.emit({
        type: 'action_decided',
        sessionId: this.session.id,
        payload: {
          step: stepNumber,
          thought: decision.thought,
          reason: decision.reason,
          action: decision.next_action,
          confidence: decision.confidence,
        },
      });

      // Finish if agent says so
      if (decision.is_finished || decision.next_action.type === 'finish') {
        this.emit({ type: 'agent_finished', sessionId: this.session.id, payload: { thought: decision.thought, step: stepNumber } });
        break;
      }

      // Execute the action
      const result = await this.actionExecutor.execute(decision.next_action, stepNumber);

      // Take screenshot after action
      let screenshotPath: string | undefined;
      if (this.session.config.screenshotOnEveryStep) {
        const screenshot = await this.screenshotManager.capture(stepNumber, decision.next_action.type);
        screenshotPath = screenshot?.path;
      }

      // Record step
      const step: StepRecord = {
        stepNumber,
        decision,
        result,
        screenshotPath,
        url: this.browser.getPage().url(),
        timestamp: new Date().toISOString(),
        networkRequests: this.networkMonitor.getRequests().slice(-5),
        consoleMessages: this.consoleMonitor.getMessages().slice(-5),
      };

      this.memory.addStep(step);
      this.session.steps.push(step);

      if (result.success) {
        this.session.passedSteps++;
        previousError = undefined;
        this.consoleMonitor.clearErrors();
        this.networkMonitor.clearErrors();
      } else {
        this.session.failedSteps++;
        previousError = result.error;
      }

      this.emit({
        type: 'step_completed',
        sessionId: this.session.id,
        payload: {
          step: stepNumber,
          success: result.success,
          error: result.error,
          screenshotPath,
          url: step.url,
        },
      });

      // Detect infinite loops
      if (this.memory.isLooping(3)) {
        this.session.error = 'Agent loop detected — stopping to avoid infinite repetition.';
        this.emit({ type: 'session_error', sessionId: this.session.id, payload: { error: this.session.error } });
        break;
      }

      // Stop if too many consecutive failures
      if (this.memory.getConsecutiveFailures() >= 5) {
        this.session.error = 'Too many consecutive failures — agent cannot proceed.';
        this.emit({ type: 'session_error', sessionId: this.session.id, payload: { error: this.session.error } });
        break;
      }

      // Small pause to avoid hammering the page
      await new Promise(r => setTimeout(r, 300));
    }

    if (this.memory.getStepCount() >= maxSteps) {
      this.session.error = `Reached maximum steps limit (${maxSteps}).`;
    }
  }

  private init(): void {
    const config: AgentConfig = { ...DEFAULT_CONFIG, ...(this.opts.config || {}) };

    this.sessionWorkspace = path.join(this.opts.workspaceRoot, this.opts.sessionId);
    fs.mkdirSync(this.sessionWorkspace, { recursive: true });

    this.session = {
      id: this.opts.sessionId,
      goal: this.opts.goal,
      baseUrl: this.opts.baseUrl,
      status: 'running',
      steps: [],
      startedAt: new Date().toISOString(),
      passedSteps: 0,
      failedSteps: 0,
      aiSuggestions: [],
      config,
    };

    this.browser = new BrowserManager();
    this.memory = new AgentMemory();

    this.gemini = new GeminiClient({
      apiKey: this.opts.geminiApiKey,
    });
  }

  private computeScore(): void {
    const total = this.session.passedSteps + this.session.failedSteps;
    if (total === 0) {
      this.session.score = 0;
      return;
    }
    this.session.score = Math.round((this.session.passedSteps / total) * 100);
  }

  private saveSession(): void {
    const sessionFile = path.join(this.sessionWorkspace, 'session.json');
    fs.writeFileSync(sessionFile, JSON.stringify(this.session, null, 2), 'utf-8');
  }

  private emit(event: BroadcastEvent): void {
    if (this.opts.broadcast) {
      try {
        this.opts.broadcast(event);
      } catch { /* ignore */ }
    }
  }

  getSession(): AgentSession {
    return this.session;
  }
}
