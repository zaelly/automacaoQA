/**
 * Core type definitions for the QA Agent system.
 * All communication between modules goes through these interfaces.
 */

// ─── Action types the agent can request ────────────────────────────────────────

export type ActionType =
  | 'goto' | 'click' | 'doubleClick' | 'hover' | 'drag' | 'drop'
  | 'scroll' | 'fill' | 'type' | 'press' | 'wait' | 'upload' | 'download'
  | 'select' | 'check' | 'uncheck'
  | 'assertText' | 'assertVisible' | 'assertUrl' | 'assertRequest' | 'assertResponse'
  | 'takeScreenshot' | 'takeSnapshot' | 'finish';

// ─── Agent action (what Gemini decides to do) ──────────────────────────────────

export interface AgentAction {
  type: ActionType;
  target?: string;
  value?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  key?: string;
  nth?: number;
}

// ─── Structured decision from Gemini ───────────────────────────────────────────

export interface AgentDecision {
  thought: string;
  reason: string;
  next_action: AgentAction;
  validation?: string;
  confidence?: number;
  is_finished?: boolean;
}

// ─── Result of executing an action ─────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
  screenshotPath?: string;
  startedAt?: string;
  finishedAt?: string;
}

// ─── Network monitoring ─────────────────────────────────────────────────────────

export interface NetworkRequest {
  url: string;
  method: string;
  status?: number;
  duration?: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  isError?: boolean;
  error?: string;
}

// ─── Console monitoring ─────────────────────────────────────────────────────────

export interface ConsoleMessage {
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  text: string;
  timestamp: string;
  location?: string;
}

// ─── Performance metrics ────────────────────────────────────────────────────────

export interface PerformanceMetrics {
  ttfb?: number;
  fcp?: number;
  lcp?: number;
  cls?: number;
  fid?: number;
  domInteractive?: number;
  domComplete?: number;
  loadEvent?: number;
  transferSize?: number;
  resourceCount?: number;
  failedResources?: number;
}

// ─── Visual analysis result ─────────────────────────────────────────────────────

export interface VisualAnalysis {
  issues: string[];
  elements: string[];
  suggestions: string[];
  score: number;
}

// ─── Complete step record ───────────────────────────────────────────────────────

export interface StepRecord {
  stepNumber: number;
  decision: AgentDecision;
  result: ActionResult;
  timestamp: string;
  url: string;
  screenshotPath?: string;
  networkRequests?: NetworkRequest[];
  consoleMessages?: ConsoleMessage[];
}

// ─── Page context sent to Gemini ───────────────────────────────────────────────

export interface PageContext {
  url: string;
  title: string;
  simplifiedHtml: string;
  accessibilityTree: string;
  screenshotBase64?: string;
  consoleErrors: string[];
  networkErrors: string[];
  jsErrors: string[];
  performance?: PerformanceMetrics;
  viewportSize: { width: number; height: number };
}

// ─── Agent configuration ────────────────────────────────────────────────────────

export interface AgentConfig {
  maxSteps: number;
  headless: boolean;
  timeout: number;
  screenshotOnEveryStep: boolean;
  videoEnabled: boolean;
  viewport: { width: number; height: number };
  slowMo?: number;
  credentials?: { username?: string; email?: string; password?: string };
}

// ─── Agent session ──────────────────────────────────────────────────────────────

export type SessionStatus = 'pending' | 'planning' | 'running' | 'completed' | 'failed' | 'stopped';

export interface AgentSession {
  id: string;
  goal: string;
  baseUrl: string;
  status: SessionStatus;
  steps: StepRecord[];
  plan?: string[];
  startedAt: string;
  finishedAt?: string;
  passedSteps: number;
  failedSteps: number;
  score?: number;
  reportPath?: string;
  videoPath?: string;
  error?: string;
  aiSuggestions: string[];
  config: AgentConfig;
}

// ─── WebSocket broadcast events ────────────────────────────────────────────────

export interface BroadcastEvent {
  type: string;
  sessionId: string;
  payload: Record<string, unknown>;
}

// ─── Healing strategy result ────────────────────────────────────────────────────

export interface HealingResult {
  found: boolean;
  strategy?: string;
  confidence?: number;
  fallbackSelector?: string;
}
