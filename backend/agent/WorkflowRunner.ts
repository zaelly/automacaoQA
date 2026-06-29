/**
 * WorkflowRunner — deterministic executor for WorkflowDefinitions.
 *
 * Responsibilities:
 *   - Iterate phases → steps in order
 *   - Call ActionLibrary for each step action
 *   - Apply retry logic per step
 *   - Respect abortOnFailure / skipOnFailure flags
 *   - Broadcast structured events for every step result
 *   - Handle 'custom' action steps via executeCustomInstruction()
 *   - Return a detailed ExecutionReport
 *
 * Never calls AI. Never interprets natural language.
 * Caller (TestRunner) provides the resolved WorkflowDefinition.
 */

import type { Page } from 'playwright';
import { ActionLibrary, type ActionResult } from './ActionLibrary';
import type { WorkflowDefinition, WorkflowStep, WorkflowPhase } from './WorkflowDefinitions';

export interface StepResult {
  stepId: string;
  action: string;
  description: string;
  status: 'passed' | 'failed' | 'skipped' | 'retried';
  detail: string;
  duration: number;
  attempts: number;
  log: string[];
}

export interface PhaseResult {
  phaseId: string;
  phaseName: string;
  status: 'passed' | 'failed' | 'skipped' | 'partial';
  steps: StepResult[];
  aborted: boolean;
  duration: number;
}

export interface WorkflowResult {
  workflowId: string;
  workflowName: string;
  status: 'passed' | 'failed' | 'partial';
  phases: PhaseResult[];
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  duration: number;
}

export type WorkflowBroadcast = (event: {
  type: string;
  payload: Record<string, unknown>;
}) => void;

export class WorkflowRunner {
  private lib = new ActionLibrary();

  async execute(
    workflow: WorkflowDefinition,
    page: Page,
    baseUrl: string,
    broadcast?: WorkflowBroadcast,
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const emit = broadcast ?? (() => {});

    emit({ type: 'workflow_start', payload: { id: workflow.id, name: workflow.name } });

    const phaseResults: PhaseResult[] = [];
    let abortWorkflow = false;

    for (const phase of workflow.phases) {
      if (abortWorkflow) {
        phaseResults.push(this.skippedPhase(phase));
        continue;
      }

      const phaseResult = await this.runPhase(phase, page, baseUrl, emit);
      phaseResults.push(phaseResult);

      if (phaseResult.aborted && phase.abortOnFailure !== false) {
        abortWorkflow = true;
        emit({
          type: 'workflow_aborted',
          payload: { phaseId: phase.id, reason: `Fase "${phase.name}" abortou o workflow` },
        });
      }
    }

    const totalSteps   = phaseResults.flatMap(p => p.steps).length;
    const passedSteps  = phaseResults.flatMap(p => p.steps).filter(s => s.status === 'passed').length;
    const failedSteps  = phaseResults.flatMap(p => p.steps).filter(s => s.status === 'failed').length;
    const skippedSteps = phaseResults.flatMap(p => p.steps).filter(s => s.status === 'skipped').length;

    const overallStatus = failedSteps === 0
      ? 'passed'
      : passedSteps > 0 ? 'partial' : 'failed';

    const result: WorkflowResult = {
      workflowId:   workflow.id,
      workflowName: workflow.name,
      status:       overallStatus,
      phases:       phaseResults,
      totalSteps,
      passedSteps,
      failedSteps,
      skippedSteps,
      duration:     Date.now() - startTime,
    };

    emit({ type: 'workflow_complete', payload: { ...result } });
    return result;
  }

  // ─── Phase ─────────────────────────────────────────────────────────────────

  private async runPhase(
    phase: WorkflowPhase,
    page: Page,
    baseUrl: string,
    emit: WorkflowBroadcast,
  ): Promise<PhaseResult> {
    const phaseStart = Date.now();
    emit({ type: 'phase_start', payload: { id: phase.id, name: phase.name } });

    const stepResults: StepResult[] = [];
    let aborted = false;

    for (let si = 0; si < phase.steps.length; si++) {
      const step = phase.steps[si];
      const stepId = `${phase.id}[${si}]`;

      const stepResult = await this.runStep(step, stepId, page, baseUrl, emit);
      stepResults.push(stepResult);

      if (stepResult.status === 'failed' && step.abortOnFailure) {
        aborted = true;
        emit({
          type: 'phase_aborted',
          payload: {
            phaseId:  phase.id,
            stepId,
            reason:   stepResult.detail,
          },
        });
        break;
      }
    }

    const passed  = stepResults.filter(s => s.status === 'passed').length;
    const failed  = stepResults.filter(s => s.status === 'failed').length;

    const phaseStatus: PhaseResult['status'] = aborted
      ? 'failed'
      : failed === 0 ? 'passed' : passed > 0 ? 'partial' : 'failed';

    const phaseResult: PhaseResult = {
      phaseId:   phase.id,
      phaseName: phase.name,
      status:    phaseStatus,
      steps:     stepResults,
      aborted,
      duration:  Date.now() - phaseStart,
    };

    emit({ type: 'phase_complete', payload: { id: phase.id, status: phaseStatus, duration: phaseResult.duration } });
    return phaseResult;
  }

  // ─── Step ──────────────────────────────────────────────────────────────────

  private async runStep(
    step: WorkflowStep,
    stepId: string,
    page: Page,
    baseUrl: string,
    emit: WorkflowBroadcast,
  ): Promise<StepResult> {
    const maxAttempts = step.retries ? step.retries + 1 : 1;
    let lastResult: ActionResult = { success: false, detail: 'Não executado', duration: 0, log: [] };
    let attempts = 0;

    emit({ type: 'step_start', payload: { stepId, action: step.action, description: step.description } });

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      attempts++;
      if (attempt > 0) {
        emit({ type: 'step_retry', payload: { stepId, attempt } });
        await page.waitForTimeout(1000);
      }

      lastResult = await this.executeAction(step, page, baseUrl);

      if (lastResult.success) break;
    }

    const status: StepResult['status'] = lastResult.success
      ? 'passed'
      : step.skipOnFailure ? 'skipped' : 'failed';

    const stepResult: StepResult = {
      stepId,
      action:      step.action,
      description: step.description,
      status,
      detail:      lastResult.detail,
      duration:    lastResult.duration,
      attempts,
      log:         lastResult.log,
    };

    emit({
      type: 'step_complete',
      payload: {
        stepId,
        status,
        detail:   lastResult.detail,
        duration: lastResult.duration,
        attempts,
      },
    });

    return stepResult;
  }

  // ─── Action dispatch ───────────────────────────────────────────────────────

  private async executeAction(step: WorkflowStep, page: Page, baseUrl: string): Promise<ActionResult> {
    const p = step.params ?? {};

    try {
      switch (step.action) {
        case 'openModule':
          return await this.lib.openModule(page, p['module'] as string, baseUrl);

        case 'validateModule':
          return await this.lib.validateModule(page, p['module'] as string);

        case 'closeModal':
          return await this.lib.closeModal(page);

        case 'buildInventory':
          return await this.lib.buildInventory(page);

        case 'searchProduct':
          return await this.lib.searchProduct(page, (p['query'] as string) ?? 'produto');

        case 'addProduct':
          return await this.lib.addProduct(page);

        case 'changeQuantity':
          return await this.lib.changeQuantity(page, (p['quantity'] as number) ?? 2);

        case 'changePrice':
          return await this.lib.changePrice(page, (p['price'] as number) ?? 0);

        case 'applyDiscount':
          return await this.lib.applyDiscount(page, (p['discountPct'] as number) ?? 10);

        case 'removeProduct':
          return await this.lib.removeProduct(page);

        case 'selectPayment':
          return await this.lib.selectPayment(page);

        case 'finishSale':
          return await this.lib.finishSale(page);

        case 'cancelSale':
          return await this.lib.cancelSale(page);

        case 'clickButton':
          return await this.lib.clickButton(page, p['label'] as string);

        case 'fillField':
          return await this.lib.fillField(page, p['fieldName'] as string, p['value'] as string);

        case 'waitForText':
          return await this.lib.waitForText(page, p['text'] as string, (p['timeout'] as number) ?? 5000);

        case 'custom':
          return await this.executeCustomInstruction(page, p['instruction'] as string);

        default:
          return {
            success: false,
            detail:  `Ação desconhecida: "${step.action}"`,
            duration: 0,
            log:     [`  ✖ Ação "${step.action}" não existe na ActionLibrary`],
          };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        detail:  `Erro interno: ${msg}`,
        duration: 0,
        log:     [`  ✖ Exception em "${step.action}": ${msg}`],
      };
    }
  }

  // ─── Custom instruction (limited best-effort) ──────────────────────────────

  private async executeCustomInstruction(page: Page, instruction: string): Promise<ActionResult> {
    const start = Date.now();
    const lower = instruction.toLowerCase();

    // fechar modal
    if (/fechar\s+(o\s+)?modal|close\s+modal/.test(lower)) {
      return this.lib.closeModal(page);
    }

    // clicar em algo
    const clickMatch = lower.match(/clicar?\s+(?:em\s+|no?\s+|na\s+)?["']?([a-záéíóúãõâêôçü\w\s]+)["']?/);
    if (clickMatch?.[1]) {
      return this.lib.clickButton(page, clickMatch[1].trim());
    }

    // preencher campo
    const fillMatch = lower.match(/preencher?\s+(?:o\s+)?(?:campo\s+)?["']?([a-záéíóúãõâêôçü\w\s]+)["']?\s+(?:com|=)\s+["']?([^"']+)/);
    if (fillMatch?.[1] && fillMatch?.[2]) {
      return this.lib.fillField(page, fillMatch[1].trim(), fillMatch[2].trim());
    }

    // buscar produto
    if (/buscar|pesquisar/.test(lower)) {
      const term = lower.replace(/buscar|pesquisar|produto|item/g, '').trim() || 'produto';
      return this.lib.searchProduct(page, term);
    }

    // aguardar texto
    const waitMatch = lower.match(/aguardar?\s+(?:texto\s+)?["']?([^"']+)["']?/);
    if (waitMatch?.[1]) {
      return this.lib.waitForText(page, waitMatch[1].trim(), 5000);
    }

    return {
      success: false,
      detail: `Instrução personalizada não reconhecida: "${instruction}" — execute manualmente`,
      duration: Date.now() - start,
      log: [`  ? Instrução sem correspondência automática: "${instruction}"`],
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private skippedPhase(phase: WorkflowPhase): PhaseResult {
    return {
      phaseId:   phase.id,
      phaseName: phase.name,
      status:    'skipped',
      steps:     phase.steps.map((s, i) => ({
        stepId:      `${phase.id}[${i}]`,
        action:      s.action,
        description: s.description,
        status:      'skipped',
        detail:      'Fase anterior abortou o workflow',
        duration:    0,
        attempts:    0,
        log:         [],
      })),
      aborted:   false,
      duration:  0,
    };
  }
}
