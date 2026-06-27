const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { findAll, update } = require('../db');

const WORKSPACE = path.join(__dirname, '..', 'workspace');

function scoreColor(score) {
  if (score === null || score === undefined) return '#64748b';
  if (score >= 85) return '#34d399';
  if (score >= 70) return '#fbbf24';
  return '#f87171';
}

function issueIcon(type) {
  if (type === 'critical') return '🔴';
  if (type === 'warning') return '🟡';
  return '🔵';
}

function formatDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── HTML Report ─────────────────────────────────────────────────────────────
async function generateHTMLReport(exec) {
  const steps = await findAll('execution_steps', { execution_id: exec.id }, { order: 'order_index', ascending: true });
  const findings    = typeof exec.findings    === 'string' ? JSON.parse(exec.findings    || '[]') : (exec.findings    || []);
  const suggestions = typeof exec.suggestions === 'string' ? JSON.parse(exec.suggestions || '[]') : (exec.suggestions || []);

  const color    = scoreColor(exec.score);
  const critical = findings.filter(f => f.type === 'critical').length;
  const warning  = findings.filter(f => f.type === 'warning').length;
  const info     = findings.filter(f => f.type === 'info').length;

  const stepsHtml = steps.map(s => `
    <div class="step ${s.status}">
      <span class="step-icon">${s.status === 'passed' ? '✓' : s.status === 'failed' ? '✗' : '○'}</span>
      <div class="step-body">
        <span class="step-name">${escapeHtml(s.name)}</span>
        ${s.duration_ms ? `<span class="step-dur">${formatDuration(s.duration_ms)}</span>` : ''}
        ${s.error_message ? `<div class="step-error">${escapeHtml(s.error_message)}</div>` : ''}
      </div>
    </div>
  `).join('');

  const findingsHtml = findings.map(f => `
    <div class="finding ${f.type}">
      <span>${issueIcon(f.type)}</span>
      <div>
        <strong>${escapeHtml(f.title)}</strong>
        <p>${escapeHtml(f.desc)}</p>
      </div>
    </div>
  `).join('');

  const suggestionsHtml = suggestions.map(s => `
    <div class="suggestion">→ ${escapeHtml(s)}</div>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relatório QATry — ${escapeHtml(exec.flow_name || 'Auditoria')}</title>
<style>
  :root { --primary: #7c3aed; --success: #34d399; --warning: #fbbf24; --danger: #f87171; --bg: #07071a; --surface: #0e0c2a; --muted: #94a3b8; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: var(--bg); color: #f1f5f9; padding: 40px 20px; }
  .container { max-width: 900px; margin: 0 auto; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .logo { width: 44px; height: 44px; background: linear-gradient(135deg, #7c3aed, #22d3ee); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; color: #fff; }
  h1 { font-size: 22px; font-weight: 800; }
  h2 { font-size: 16px; font-weight: 700; color: #f1f5f9; margin-bottom: 12px; margin-top: 28px; }
  .meta { font-size: 13px; color: var(--muted); margin-top: 2px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 24px 0; }
  .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; text-align: center; }
  .card-val { font-size: 28px; font-weight: 800; }
  .card-label { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .finding { display: flex; gap: 12px; align-items: flex-start; background: rgba(255,255,255,0.04); border-radius: 10px; padding: 12px; margin-bottom: 8px; border-left: 3px solid; }
  .finding.critical { border-color: var(--danger); }
  .finding.warning  { border-color: var(--warning); }
  .finding.info     { border-color: #22d3ee; }
  .finding strong { display: block; font-size: 14px; margin-bottom: 4px; }
  .finding p { font-size: 13px; color: var(--muted); }
  .suggestion { background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.2); border-radius: 8px; padding: 10px 14px; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
  .step { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .step-icon { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 2px; }
  .step.passed .step-icon { background: rgba(52,211,153,0.2);  color: var(--success); }
  .step.failed .step-icon { background: rgba(248,113,113,0.2); color: var(--danger); }
  .step-name { font-size: 13px; }
  .step-dur  { font-size: 11px; color: var(--muted); margin-left: 8px; }
  .step-error { font-size: 12px; color: var(--danger); margin-top: 4px; font-family: monospace; }
  footer { margin-top: 48px; text-align: center; font-size: 12px; color: #334155; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">Q</div>
    <div>
      <h1>${escapeHtml(exec.flow_name || 'Auditoria IA')}</h1>
      <div class="meta">
        Projeto: ${escapeHtml(exec.project_name || '—')} &nbsp;|&nbsp;
        URL: ${escapeHtml(exec.base_url || '—')} &nbsp;|&nbsp;
        ${exec.started_at ? new Date(exec.started_at).toLocaleString('pt-BR') : '—'}
      </div>
    </div>
  </div>

  <div class="cards">
    <div class="card">
      <div class="card-val" style="color:${color}">${exec.score ?? '—'}</div>
      <div class="card-label">Score Geral</div>
    </div>
    <div class="card">
      <div class="card-val" style="color:#f87171">${critical}</div>
      <div class="card-label">Críticos</div>
    </div>
    <div class="card">
      <div class="card-val" style="color:#fbbf24">${warning}</div>
      <div class="card-label">Avisos</div>
    </div>
    <div class="card">
      <div class="card-val" style="color:#22d3ee">${info}</div>
      <div class="card-label">Informações</div>
    </div>
    <div class="card">
      <div class="card-val">${formatDuration(exec.duration_ms)}</div>
      <div class="card-label">Duração</div>
    </div>
    <div class="card">
      <div class="card-val">${exec.passed_steps ?? 0}/${exec.total_steps ?? 0}</div>
      <div class="card-label">Steps OK</div>
    </div>
  </div>

  ${findings.length    > 0 ? `<h2>Issues Encontrados</h2>${findingsHtml}`       : ''}
  ${suggestions.length > 0 ? `<h2>Sugestões de Melhoria</h2>${suggestionsHtml}` : ''}
  ${steps.length       > 0 ? `<h2>Steps de Execução</h2><div>${stepsHtml}</div>` : ''}

  <footer>Gerado por QATry — ${new Date().toLocaleString('pt-BR')}</footer>
</div>
</body>
</html>`;

  const reportDir  = path.join(WORKSPACE, exec.id);
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'report.html');
  fs.writeFileSync(reportPath, html, 'utf8');

  await update('executions', { id: exec.id }, { report_path: `${exec.id}/report.html` }).catch(() => {});

  return reportPath;
}

// ─── PDF via Playwright ───────────────────────────────────────────────────────
async function generatePDFReport(exec) {
  const htmlPath = await generateHTMLReport(exec);
  const pdfPath  = htmlPath.replace('.html', '.pdf');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });
  } finally {
    await browser.close();
  }

  return pdfPath;
}

module.exports = { generateHTMLReport, generatePDFReport };
