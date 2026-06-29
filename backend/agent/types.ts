/**
 * Core type definitions for the QA system.
 *
 * Two flows exist:
 *   - AgentExecutor (v1): AI decides each step in real-time (Gemini)
 *   - TestRunner (v2):    Playwright runs all checks → ONE Groq call for analysis
 */

// ─── Audit modes & execution contract ───────────────────────────────────────

export type AuditMode = 'global' | 'module' | 'flow';

export interface TestGroup {
  id: string;
  name: string;
  emoji: string;
  category: 'functional' | 'seo' | 'links' | 'accessibility' | 'performance' | 'network';
  module?: string;
}

export interface ExecutionContract {
  mode: AuditMode;
  intent: string;
  intentName: string;
  intentEmoji: string;
  allowedTests: TestGroup[];   // shown as ✔ in UI
  forbiddenItems: TestGroup[]; // shown as ✖ in UI
  forbiddenCategories: string[];
  customSteps?: string[];
  needsClarification?: boolean;
}

// ─── Shared ─────────────────────────────────────────────────────────────────

export interface PerformanceMetrics {
  ttfb?: number;
  fcp?: number;
  lcp?: number;
  cls?: number;
  domInteractive?: number;
  domComplete?: number;
  loadEvent?: number;
  transferSize?: number;
  resourceCount?: number;
  failedResources?: number;
}

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

export interface ConsoleMessage {
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  text: string;
  timestamp: string;
  location?: string;
}

export interface HealingResult {
  found: boolean;
  strategy?: string;
  confidence?: number;
  fallbackSelector?: string;
}

// ─── V1 Agent types (AgentExecutor + GeminiClient) ──────────────────────────

export type ActionType =
  | 'goto' | 'click' | 'doubleClick' | 'hover' | 'drag' | 'drop'
  | 'scroll' | 'fill' | 'type' | 'press' | 'wait' | 'upload' | 'download'
  | 'select' | 'check' | 'uncheck'
  | 'assertText' | 'assertVisible' | 'assertUrl' | 'assertRequest' | 'assertResponse'
  | 'takeScreenshot' | 'takeSnapshot' | 'finish';

export interface AgentAction {
  type: ActionType;
  target?: string;
  value?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  key?: string;
  nth?: number;
}

export interface AgentDecision {
  thought: string;
  reason: string;
  next_action: AgentAction;
  validation?: string;
  confidence?: number;
  is_finished?: boolean;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
  screenshotPath?: string;
  startedAt?: string;
  finishedAt?: string;
}

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

export interface AgentConfig {
  maxSteps: number;
  headless: boolean;
  timeout: number;
  screenshotOnEveryStep: boolean;
  videoEnabled: boolean;
  viewport: { width: number; height: number };
  slowMo?: number;
}

export interface VisualAnalysis {
  issues: string[];
  elements: string[];
  suggestions: string[];
  score: number;
}

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

// ─── V2 Batch testing types (TestRunner + GroqClient) ──────────────────────

export interface TestCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'info';
  detail: string;
}

// Timestamped record of every action taken
export interface TimelineEvent {
  timestamp: string;
  type: 'navigate' | 'found' | 'fill' | 'click' | 'success' | 'error' | 'warning' | 'skipped' | 'info';
  flowName: string;   // Which flow this belongs to: 'login', 'links', 'forms', etc.
  description: string;
  detail?: string;
  screenshotPath?: string;
  durationMs?: number;
  url?: string;
}

// A named test flow (Login, Links, Forms, etc.)
export interface TestFlow {
  name: string;
  url: string;
  status: 'pass' | 'fail' | 'skipped' | 'partial';
  reason?: string;          // Why it failed or was skipped
  blockedBy?: string;       // e.g. "Login"
  errorMessage?: string;    // Visible DOM error message
  screenshots: string[];
  events: TimelineEvent[];
}

// A broken link with full context
export interface BrokenLink {
  text: string;
  href: string;
  status: number;
  elementHtml?: string;
}

// Full detail of a network error
export interface NetworkErrorDetail {
  method: string;
  url: string;
  status?: number;
  duration?: number;
  responseBody?: string;
  error?: string;
  timestamp: string;
}

export interface FormTestResult {
  index: number;
  action: string;
  fields: string[];
  emptySubmitStatus?: number;
  testSubmitStatus?: number;
  errorMessage?: string;
  successMessage?: string;
}

export interface PageTestResult {
  url: string;
  title: string;
  checks: TestCheck[];
  consoleErrors: string[];
  networkErrors: NetworkRequest[];
  performance: PerformanceMetrics;
  screenshots: Array<{ label?: string; path: string }>;
  formResults: FormTestResult[];
}

export interface TestSummary {
  sessionId: string;
  goal: string;
  baseUrl: string;
  // Audit contract
  contract?: ExecutionContract;
  // Intent (kept for compat)
  intent?: string;
  intentName?: string;
  intentSteps?: string[];
  customSteps?: string[];
  // Summary stats (for quick display)
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  // Structured data
  timeline: TimelineEvent[];
  flows: TestFlow[];
  brokenLinks: BrokenLink[];
  networkErrors: NetworkErrorDetail[];
  consoleErrors: string[];
  performance: PerformanceMetrics;
  loginStatus: 'pass' | 'fail' | 'not_detected';
  loginError?: string;
  videoPath?: string;
  // Timing
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface AnalysisFinding {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  possibleCause: string;
  howToReproduce: string;
  suggestion: string;
  affectedUrl?: string;
  affectedFlow?: string;
}

export interface AnalysisReport {
  summary: string;
  overallScore: number;
  findings: AnalysisFinding[];
  recommendations: string[];
  generatedAt: string;
  model: string;
}

export interface QaSession {
  id: string;
  goal: string;
  baseUrl: string;
  status: 'running' | 'analyzing' | 'completed' | 'failed';
  testSummary?: TestSummary;
  report?: AnalysisReport;
  videoPath?: string;
  contract?: ExecutionContract;
  intent?: string;
  intentName?: string;
  customSteps?: string[];
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

// ─── WebSocket events ────────────────────────────────────────────────────────

export interface BroadcastEvent {
  type: string;
  sessionId: string;
  payload: Record<string, unknown>;
}

// ─── V1 PageContext (used by GeminiClient + PageAnalyzer) ────────────────────

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
