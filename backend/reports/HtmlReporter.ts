/**
 * HtmlReporter — generates a self-contained HTML report for an agent session.
 *
 * The report includes:
 * - Session summary (score, steps, status, duration)
 * - Visual timeline with screenshots embedded as base64
 * - Agent thoughts per step (AI reasoning)
 * - Console and network error summaries
 * - Performance metrics
 * - Video link if available
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AgentSession, StepRecord } from '../agent/types';

export class HtmlReporter {
  generate(session: AgentSession, outputPath: string): string {
    const html = this.buildHtml(session);
    fs.writeFileSync(outputPath, html, 'utf-8');
    return outputPath;
  }

  private buildHtml(session: AgentSession): string {
    const duration = session.finishedAt
      ? Math.round((new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
      : 0;

    const scoreColor = session.score === undefined ? '#888' :
      session.score >= 80 ? '#22c55e' :
      session.score >= 50 ? '#f59e0b' : '#ef4444';

    const statusEmoji = session.status === 'completed' ? '✅' :
      session.status === 'failed' ? '❌' : '⏳';

    const stepsHtml = session.steps.map(step => this.buildStepHtml(step)).join('\n');

    const planHtml = session.plan && session.plan.length > 0
      ? `<div class="plan-box"><h3>📋 Plano de Teste</h3><ol>${session.plan.map(p => `<li>${this.esc(p)}</li>`).join('')}</ol></div>`
      : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatório QATry — ${this.esc(session.goal)}</title>
<style>
  :root {
    --bg: #0f0f1a; --surface: #1a1a2e; --border: #2d2d4e;
    --text: #e2e8f0; --muted: #94a3b8;
    --green: #22c55e; --red: #ef4444; --yellow: #f59e0b;
    --purple: #8b5cf6; --blue: #3b82f6;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', sans-serif; line-height: 1.5; }
  .container { max-width: 1100px; margin: 0 auto; padding: 32px 20px; }
  header { border-bottom: 1px solid var(--border); padding-bottom: 24px; margin-bottom: 32px; }
  h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 6px; }
  h1 small { font-size: 0.85rem; color: var(--muted); font-weight: 400; }
  .meta { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 16px; }
  .badge { display: flex; align-items: center; gap: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 14px; font-size: 0.85rem; }
  .badge strong { font-size: 1.1rem; }
  .score-badge strong { color: ${scoreColor}; font-size: 1.4rem; }
  .plan-box { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 32px; }
  .plan-box h3 { font-size: 0.95rem; margin-bottom: 10px; color: var(--purple); }
  .plan-box ol { padding-left: 20px; color: var(--muted); font-size: 0.9rem; line-height: 1.8; }
  .steps-header { font-size: 1rem; font-weight: 600; margin-bottom: 16px; color: var(--purple); }
  .step { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 16px; overflow: hidden; }
  .step-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); cursor: pointer; }
  .step-num { font-size: 0.75rem; color: var(--muted); min-width: 48px; }
  .step-icon { font-size: 1.1rem; }
  .step-action { flex: 1; font-size: 0.9rem; font-weight: 500; }
  .step-status { font-size: 0.8rem; padding: 2px 8px; border-radius: 12px; }
  .step-status.pass { background: rgba(34,197,94,0.15); color: var(--green); }
  .step-status.fail { background: rgba(239,68,68,0.15); color: var(--red); }
  .step-body { padding: 16px; display: none; }
  .step-body.open { display: block; }
  .thought-box { background: rgba(139,92,246,0.08); border: 1px solid rgba(139,92,246,0.2); border-radius: 8px; padding: 12px; margin-bottom: 12px; font-size: 0.85rem; }
  .thought-box .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--purple); margin-bottom: 4px; }
  .error-box { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 12px; font-size: 0.85rem; color: var(--red); margin-top: 8px; }
  .screenshot { margin-top: 12px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
  .screenshot img { width: 100%; display: block; }
  .perf-section { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 0.85rem; color: var(--muted); }
  footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--border); text-align: center; font-size: 0.8rem; color: var(--muted); }
  .error-msg { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 16px; margin-bottom: 24px; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>${statusEmoji} ${this.esc(session.goal)} <small>— ${this.esc(session.baseUrl)}</small></h1>
    <div class="meta">
      <div class="badge score-badge">
        <span>Score</span>
        <strong>${session.score !== undefined ? session.score + '%' : 'N/A'}</strong>
      </div>
      <div class="badge">
        <span>Status</span>
        <strong>${session.status}</strong>
      </div>
      <div class="badge">
        <span>Passos</span>
        <strong>${session.passedSteps} ✅ / ${session.failedSteps} ❌</strong>
      </div>
      <div class="badge">
        <span>Duração</span>
        <strong>${duration}s</strong>
      </div>
      <div class="badge">
        <span>Início</span>
        <strong>${new Date(session.startedAt).toLocaleString('pt-BR')}</strong>
      </div>
    </div>
  </header>

  ${session.error ? `<div class="error-msg">⚠️ ${this.esc(session.error)}</div>` : ''}
  ${planHtml}

  <div class="steps-header">🔄 Timeline de Execução (${session.steps.length} passos)</div>
  ${stepsHtml}

  ${this.buildPerfSection(session)}

  <footer>Gerado por QATry Agent · ${new Date().toLocaleString('pt-BR')}</footer>
</div>

<script>
  document.querySelectorAll('.step-header').forEach(h => {
    h.addEventListener('click', () => {
      const body = h.nextElementSibling;
      body.classList.toggle('open');
    });
  });
</script>
</body>
</html>`;
  }

  private buildStepHtml(step: StepRecord): string {
    const action = step.decision.next_action;
    const success = step.result.success;
    const statusClass = success ? 'pass' : 'fail';
    const statusLabel = success ? '✅ OK' : '❌ Falhou';
    const icon = this.actionIcon(action.type);
    const actionDesc = `${action.type}${action.target ? ` → "${action.target}"` : ''}${action.value ? ` = "${action.value}"` : ''}`;

    const screenshotHtml = step.screenshotPath && fs.existsSync(step.screenshotPath)
      ? (() => {
          const b64 = fs.readFileSync(step.screenshotPath).toString('base64');
          return `<div class="screenshot"><img src="data:image/png;base64,${b64}" alt="Step ${step.stepNumber}" /></div>`;
        })()
      : '';

    return `
<div class="step">
  <div class="step-header">
    <span class="step-num">Passo ${step.stepNumber}</span>
    <span class="step-icon">${icon}</span>
    <span class="step-action">${this.esc(actionDesc)}</span>
    <span class="step-status ${statusClass}">${statusLabel}</span>
  </div>
  <div class="step-body">
    <div class="thought-box">
      <div class="label">💭 Raciocínio do Agente</div>
      ${this.esc(step.decision.thought)}
    </div>
    <div style="font-size:0.82rem;color:var(--muted);margin-bottom:8px;">
      <strong>Motivo:</strong> ${this.esc(step.decision.reason)}<br>
      ${step.decision.validation ? `<strong>Esperado:</strong> ${this.esc(step.decision.validation)}` : ''}
      ${step.decision.confidence !== undefined ? ` · <strong>Confiança:</strong> ${Math.round(step.decision.confidence * 100)}%` : ''}
    </div>
    ${!success && step.result.error ? `<div class="error-box">❌ ${this.esc(step.result.error)}</div>` : ''}
    ${screenshotHtml}
  </div>
</div>`;
  }

  private buildPerfSection(session: AgentSession): string {
    const lastStep = session.steps.at(-1);
    if (!lastStep?.result.data?.performance) return '';

    const p = lastStep.result.data.performance as Record<string, number | undefined>;
    const items = [
      p['ttfb'] !== undefined && `TTFB: ${p['ttfb']}ms`,
      p['fcp'] !== undefined && `FCP: ${p['fcp']}ms`,
      p['lcp'] !== undefined && `LCP: ${p['lcp']}ms`,
      p['loadEvent'] !== undefined && `Load: ${p['loadEvent']}ms`,
      p['resourceCount'] !== undefined && `${p['resourceCount']} recursos`,
    ].filter(Boolean).join(' · ');

    if (!items) return '';

    return `<div class="perf-section"><strong>⚡ Performance:</strong> ${items}</div>`;
  }

  private actionIcon(type: string): string {
    const map: Record<string, string> = {
      goto: '🌐', click: '👆', doubleClick: '👆👆', hover: '🖱️',
      fill: '✍️', type: '⌨️', press: '⌨️', scroll: '📜',
      select: '📋', check: '☑️', uncheck: '☐', wait: '⏳',
      upload: '📤', download: '📥', drag: '🤏',
      assertText: '🔍', assertVisible: '👁️', assertUrl: '🔗',
      assertRequest: '📡', assertResponse: '📡',
      takeScreenshot: '📸', takeSnapshot: '💾', finish: '🏁',
    };
    return map[type] || '⚙️';
  }

  private esc(s?: string): string {
    if (!s) return '';
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
