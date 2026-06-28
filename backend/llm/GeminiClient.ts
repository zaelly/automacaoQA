/**
 * GeminiClient — wraps @google/generative-ai to act as the agent's brain.
 *
 * Design decisions:
 * - Uses JSON response mode (responseMimeType: "application/json") for reliable parsing
 * - Sends full page context (HTML, a11y tree, screenshot, history) each turn
 * - Keeps conversation history in memory for multi-turn context
 * - Visual analysis uses a separate vision model call
 */

import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai';
import type {
  AgentDecision,
  AgentAction,
  PageContext,
  StepRecord,
  VisualAnalysis,
} from '../agent/types';
import {
  AGENT_SYSTEM_PROMPT,
  VISUAL_ANALYSIS_PROMPT,
  PLAN_PROMPT,
  HEALING_PROMPT,
} from './prompts';

export interface GeminiClientConfig {
  apiKey: string;
  model?: string;           // Default: gemini-2.0-flash
  visionModel?: string;     // Default: gemini-2.0-flash (supports vision)
  maxOutputTokens?: number;
  temperature?: number;
}

export class GeminiClient {
  private ai: GoogleGenerativeAI;
  private model: GenerativeModel;
  private visionModel: GenerativeModel;
  private config: Required<GeminiClientConfig>;

  constructor(config: GeminiClientConfig) {
    this.config = {
      model: 'gemini-2.0-flash',
      visionModel: 'gemini-2.0-flash',
      maxOutputTokens: 2048,
      temperature: 0.1, // Low temperature for consistent, deterministic decisions
      ...config,
    };

    this.ai = new GoogleGenerativeAI(this.config.apiKey);

    const generationConfig = {
      temperature: this.config.temperature,
      maxOutputTokens: this.config.maxOutputTokens,
      responseMimeType: 'application/json',
    };

    this.model = this.ai.getGenerativeModel({
      model: this.config.model,
      systemInstruction: AGENT_SYSTEM_PROMPT,
      generationConfig,
    });

    this.visionModel = this.ai.getGenerativeModel({
      model: this.config.visionModel,
      generationConfig,
    });
  }

  /**
   * Ask Gemini what to do next given the current page state and history.
   * This is the core agent decision loop call.
   */
  async decide(
    goal: string,
    context: PageContext,
    history: StepRecord[],
    previousError?: string,
  ): Promise<AgentDecision> {
    const prompt = this.buildDecisionPrompt(goal, context, history, previousError);

    try {
      const parts: Part[] = [{ text: prompt }];

      // Attach screenshot if available (vision input)
      if (context.screenshotBase64) {
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: context.screenshotBase64,
          },
        });
      }

      const result = await this.model.generateContent(parts);
      const text = result.response.text();

      return this.parseDecision(text);
    } catch (err: any) {
      console.error('[GeminiClient] decide error:', err.message);
      // Return a safe finish action on API failure
      return {
        thought: `Gemini API error: ${err.message}`,
        reason: 'Cannot proceed without AI guidance',
        next_action: { type: 'finish' },
        confidence: 0,
      };
    }
  }

  /**
   * Create a high-level test plan from a natural language goal.
   */
  async plan(goal: string, baseUrl: string): Promise<{ plan: string[]; estimatedActions: number; riskAreas: string[] }> {
    try {
      const result = await this.model.generateContent(PLAN_PROMPT(goal, baseUrl));
      const text = result.response.text();
      const parsed = JSON.parse(text);
      return {
        plan: parsed.plan || [],
        estimatedActions: parsed.estimatedActions || 10,
        riskAreas: parsed.riskAreas || [],
      };
    } catch {
      return { plan: [`Execute: ${goal}`], estimatedActions: 10, riskAreas: [] };
    }
  }

  /**
   * Perform visual analysis of a screenshot.
   * Returns issues, suggestions, and quality score.
   */
  async analyzeVisual(screenshotBase64: string): Promise<VisualAnalysis> {
    try {
      const parts: Part[] = [
        { text: VISUAL_ANALYSIS_PROMPT },
        {
          inlineData: {
            mimeType: 'image/png',
            data: screenshotBase64,
          },
        },
      ];

      const result = await this.visionModel.generateContent(parts);
      const text = result.response.text();
      const parsed = JSON.parse(text);

      return {
        issues: parsed.issues || [],
        elements: parsed.elements || [],
        suggestions: parsed.suggestions || [],
        score: parsed.score ?? 80,
      };
    } catch {
      return { issues: [], elements: [], suggestions: [], score: 80 };
    }
  }

  /**
   * Ask Gemini for an alternative selector when auto-healing fails.
   */
  async healSelector(target: string, html: string, screenshotBase64?: string): Promise<{
    selector: string;
    selectorType: 'css' | 'xpath';
    confidence: number;
  } | null> {
    try {
      const parts: Part[] = [{ text: HEALING_PROMPT(target, html, screenshotBase64) }];

      if (screenshotBase64) {
        parts.push({ inlineData: { mimeType: 'image/png', data: screenshotBase64 } });
      }

      const result = await this.visionModel.generateContent(parts);
      const text = result.response.text();
      const parsed = JSON.parse(text);

      if (parsed.selector) {
        return {
          selector: parsed.selector,
          selectorType: parsed.selectorType || 'css',
          confidence: parsed.confidence || 0.5,
        };
      }
    } catch { /* ignore */ }
    return null;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private buildDecisionPrompt(
    goal: string,
    context: PageContext,
    history: StepRecord[],
    previousError?: string,
  ): string {
    const historyText = history
      .slice(-10) // Last 10 steps to keep context manageable
      .map((s, i) => {
        const action = s.decision.next_action;
        const status = s.result.success ? '✅' : '❌';
        return `Step ${s.stepNumber}: ${status} ${action.type}${action.target ? ` on "${action.target}"` : ''}${action.value ? ` = "${action.value}"` : ''}${s.result.error ? ` → ERROR: ${s.result.error}` : ''}`;
      })
      .join('\n');

    const errorsSection = [
      ...context.consoleErrors.slice(-5).map(e => `[CONSOLE ERROR] ${e}`),
      ...context.jsErrors.slice(-3).map(e => `[JS ERROR] ${e}`),
      ...context.networkErrors.slice(-3).map(e => `[NETWORK ERROR] ${e}`),
    ].join('\n');

    return `
## TEST GOAL
${goal}

## CURRENT STATE
URL: ${context.url}
Title: ${context.title}
Viewport: ${context.viewportSize.width}x${context.viewportSize.height}

## PAGE STRUCTURE (Simplified HTML)
${context.simplifiedHtml}

## INTERACTIVE ELEMENTS (Accessibility Tree)
${context.accessibilityTree}

${errorsSection ? `## ERRORS ON PAGE\n${errorsSection}\n` : ''}
${previousError ? `## PREVIOUS ACTION FAILED\n${previousError}\n` : ''}
## ACTION HISTORY (${history.length} steps)
${historyText || 'No actions taken yet.'}

## TASK
Decide the next action to take. Remember:
- Focus on the test goal
- Build on the action history
- If the previous action failed, try a different approach
- Use "finish" when the goal is achieved or you cannot proceed

Respond with JSON only.
    `.trim();
  }

  private parseDecision(text: string): AgentDecision {
    // Strip markdown code blocks if present
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.next_action || !parsed.next_action.type) {
      throw new Error('Invalid decision: missing next_action.type');
    }

    const action: AgentAction = {
      type: parsed.next_action.type,
      target: parsed.next_action.target,
      value: parsed.next_action.value,
      direction: parsed.next_action.direction,
      amount: parsed.next_action.amount,
      key: parsed.next_action.key,
      nth: parsed.next_action.nth,
    };

    return {
      thought: parsed.thought || '',
      reason: parsed.reason || '',
      next_action: action,
      validation: parsed.validation,
      confidence: parsed.confidence ?? 0.8,
      is_finished: action.type === 'finish',
    };
  }
}
