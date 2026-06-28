/**
 * AgentMemory — manages step history and prevents the agent from looping.
 *
 * Tracks: step records, repeated failures, action patterns,
 * and provides a trimmed history window for the LLM context.
 */

import type { StepRecord, AgentAction } from './types';

export class AgentMemory {
  private steps: StepRecord[] = [];
  private actionFingerprints = new Map<string, number>(); // fingerprint → count

  addStep(step: StepRecord): void {
    this.steps.push(step);

    // Track repeated actions to detect loops
    const fp = this.fingerprint(step.decision.next_action);
    this.actionFingerprints.set(fp, (this.actionFingerprints.get(fp) || 0) + 1);
  }

  getSteps(): StepRecord[] {
    return [...this.steps];
  }

  /** Returns the last N steps for LLM context (avoids blowing the token budget). */
  getHistory(limit = 15): StepRecord[] {
    return this.steps.slice(-limit);
  }

  getLastStep(): StepRecord | undefined {
    return this.steps.at(-1);
  }

  getStepCount(): number {
    return this.steps.length;
  }

  getFailureCount(): number {
    return this.steps.filter(s => !s.result.success).length;
  }

  getConsecutiveFailures(): number {
    let count = 0;
    for (let i = this.steps.length - 1; i >= 0; i--) {
      if (!this.steps[i].result.success) count++;
      else break;
    }
    return count;
  }

  /** Detect if the agent is stuck repeating the same action. */
  isLooping(threshold = 3): boolean {
    for (const count of this.actionFingerprints.values()) {
      if (count >= threshold) return true;
    }

    // Also check last 5 steps for identical actions
    const last5 = this.steps.slice(-5);
    if (last5.length < 3) return false;

    const fps = last5.map(s => this.fingerprint(s.decision.next_action));
    const unique = new Set(fps);
    return unique.size === 1; // All 5 identical
  }

  /** Summary of what happened for reporting. */
  getSummary(): {
    total: number;
    passed: number;
    failed: number;
    actions: Record<string, number>;
  } {
    const actions: Record<string, number> = {};
    let passed = 0;
    let failed = 0;

    for (const step of this.steps) {
      const type = step.decision.next_action.type;
      actions[type] = (actions[type] || 0) + 1;
      if (step.result.success) passed++;
      else failed++;
    }

    return { total: this.steps.length, passed, failed, actions };
  }

  private fingerprint(action: AgentAction): string {
    return `${action.type}|${action.target || ''}|${action.value || ''}`;
  }
}
