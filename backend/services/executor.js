const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');

const WORKSPACE = path.join(__dirname, '..', 'workspace');

// Track running executions so they can be stopped
const running = new Map();

function getWorkspacePaths(executionId) {
  const dir = path.join(WORKSPACE, executionId);
  fs.mkdirSync(path.join(dir, 'screenshots'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'videos'), { recursive: true });
  return {
    dir,
    screenshots: path.join(dir, 'screenshots'),
    videos: path.join(dir, 'videos'),
  };
}

function broadcast(executionId, payload) {
  if (global.broadcast) global.broadcast(executionId, payload);
}

function updateExecution(db, id, fields) {
  const sets = Object.entries(fields).map(([k]) => `${k}=?`).join(', ');
  const vals = [...Object.values(fields), id];
  db.prepare(`UPDATE executions SET ${sets} WHERE id=?`).run(...vals);
}

function saveStep(db, executionId, { name, status, screenshotPath = null, errorMessage = null, durationMs = 0, orderIndex = 0 }) {
  const stepId = uuid();
  db.prepare(`
    INSERT INTO execution_steps (id, execution_id, name, status, screenshot_path, error_message, duration_ms, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(stepId, executionId, name, status, screenshotPath, errorMessage, durationMs, orderIndex);
  return stepId;
}

// ─── Main entry: start a given execution record ────────────────────────────
async function startExecution(executionId, options = {}) {
  const { db } = require('../db');
  const exec = db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId);
  if (!exec) throw new Error('Execução não encontrada');

  const { dir, screenshots, videos } = getWorkspacePaths(executionId);

  let stopped = false;
  running.set(executionId, { stop: () => { stopped = true; } });

  updateExecution(db, executionId, { status: 'running' });
  broadcast(executionId, { type: 'started' });

  const startTime = Date.now();
  let browser, context, page;

  try {
    const launchOptions = { headless: true };
    browser = await chromium.launch(launchOptions);

    const contextOptions = {};
    if (options.recordVideo) {
      contextOptions.recordVideo = { dir: videos, size: { width: 1280, height: 720 } };
    }
    context = await browser.newContext(contextOptions);
    page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => consoleErrors.push(err.message));

    let totalSteps = 0, passedSteps = 0, failedSteps = 0;

    // Step runner helper used inside flows and audit
    const step = async (name, fn) => {
      if (stopped) throw new Error('STOPPED');
      totalSteps++;
      const stepIndex = totalSteps;
      const t0 = Date.now();
      broadcast(executionId, { type: 'step_start', name, index: stepIndex });

      try {
        await fn();
        const dur = Date.now() - t0;
        passedSteps++;
        saveStep(db, executionId, { name, status: 'passed', durationMs: dur, orderIndex: stepIndex });
        broadcast(executionId, { type: 'step_pass', name, index: stepIndex, durationMs: dur });
      } catch (err) {
        if (err.message === 'STOPPED') throw err;
        const dur = Date.now() - t0;
        failedSteps++;

        // Auto-screenshot on step failure
        let ssRel = null;
        try {
          const ssFile = path.join(screenshots, `step-${stepIndex}.png`);
          await page.screenshot({ path: ssFile, fullPage: false });
          ssRel = `${executionId}/screenshots/step-${stepIndex}.png`;
        } catch (_) {}

        saveStep(db, executionId, { name, status: 'failed', screenshotPath: ssRel, errorMessage: err.message, durationMs: dur, orderIndex: stepIndex });
        broadcast(executionId, { type: 'step_fail', name, index: stepIndex, error: err.message, screenshot: ssRel, durationMs: dur });
      }
      return { passedSteps, failedSteps };
    };

    // Choose execution mode: project flow or AI audit
    const flow = exec.flow_id ? db.prepare('SELECT * FROM flows WHERE id = ?').get(exec.flow_id) : null;
    const testUser = exec.flow_id
      ? db.prepare('SELECT * FROM test_users WHERE project_id = ? LIMIT 1').get(exec.project_id)
      : null;

    let findings = [], suggestions = [], score = null;

    if (flow) {
      await runFlowScript(flow.script, page, {
        baseUrl: exec.base_url,
        testUser: testUser || { username: '', password: '' },
        step,
      });
      score = failedSteps === 0 ? 100 : Math.round((passedSteps / Math.max(totalSteps, 1)) * 100);
    } else {
      const result = await runAIAudit(page, exec.base_url, step, consoleErrors);
      findings = result.findings;
      suggestions = result.suggestions;
      score = result.score;
    }

    // Finalize video
    let videoPath = null;
    if (options.recordVideo) {
      const videoFile = await page.video()?.path();
      if (videoFile) videoPath = path.relative(WORKSPACE, videoFile);
    }

    await context.close();
    await browser.close();

    const status = failedSteps === 0 ? 'passed' : (passedSteps === 0 ? 'failed' : 'passed');
    const durationMs = Date.now() - startTime;

    updateExecution(db, executionId, {
      status,
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      total_steps: totalSteps,
      passed_steps: passedSteps,
      failed_steps: failedSteps,
      score,
      findings: JSON.stringify(findings),
      suggestions: JSON.stringify(suggestions),
      video_path: videoPath,
    });

    broadcast(executionId, { type: 'finished', status, score, durationMs, passedSteps, failedSteps, findings, suggestions });
  } catch (err) {
    try { await context?.close(); } catch (_) {}
    try { await browser?.close(); } catch (_) {}

    if (err.message === 'STOPPED') {
      updateExecution(db, executionId, { status: 'stopped', finished_at: new Date().toISOString(), duration_ms: Date.now() - startTime });
      broadcast(executionId, { type: 'finished', status: 'stopped' });
    } else {
      updateExecution(db, executionId, { status: 'failed', finished_at: new Date().toISOString(), duration_ms: Date.now() - startTime });
      broadcast(executionId, { type: 'finished', status: 'failed', error: err.message });
      console.error(`[executor] ${executionId}:`, err.message);
    }
  } finally {
    running.delete(executionId);
  }
}

function stopExecution(executionId) {
  const entry = running.get(executionId);
  if (entry) entry.stop();
}

// ─── Flow script runner ─────────────────────────────────────────────────────
async function runFlowScript(script, page, context) {
  try {
    // Wrap user script in an async function and call it
    const wrappedScript = `(async function(page, context) {
      const { baseUrl, testUser, step } = context;
      ${script.replace(/^async function flow[^{]+\{/, '').replace(/\}$/, '')}
    })`;
    const fn = eval(wrappedScript); // eslint-disable-line no-eval
    await fn(page, context);
  } catch (err) {
    if (err.message === 'STOPPED') throw err;
    // Log script errors but don't crash the executor
    broadcast('', { type: 'script_error', error: err.message });
  }
}

// ─── AI Audit mode ──────────────────────────────────────────────────────────
async function runAIAudit(page, url, step, consoleErrors) {
  const findings = [];
  const suggestions = [];
  let criticalCount = 0, warningCount = 0, infoCount = 0;

  const addFinding = (type, title, desc) => {
    findings.push({ type, title, desc });
    if (type === 'critical') criticalCount++;
    else if (type === 'warning') warningCount++;
    else infoCount++;
  };

  // 1. Navegação inicial
  await step('Carregando a URL alvo', async () => {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!resp || resp.status() >= 400) {
      addFinding('critical', 'URL inacessível', `O servidor retornou status ${resp?.status()} para ${url}`);
    }
  });

  // 2. Título
  await step('Verificando título da página', async () => {
    const title = await page.title();
    if (!title || title.trim() === '') {
      addFinding('warning', 'Título ausente', 'A página não possui tag <title> definida, o que prejudica SEO e acessibilidade.');
      suggestions.push('Adicione uma tag <title> descritiva em cada página.');
    }
  });

  // 3. Meta description
  await step('Verificando meta description (SEO)', async () => {
    const metaDesc = await page.$('meta[name="description"]');
    if (!metaDesc) {
      addFinding('info', 'Meta description ausente', 'Nenhuma meta description encontrada. Importante para SEO.');
      suggestions.push('Adicione <meta name="description" content="..."> a cada página.');
    }
  });

  // 4. Imagens sem alt
  await step('Verificando imagens sem atributo alt', async () => {
    const badImgs = await page.$$eval('img', imgs => imgs.filter(i => !i.alt || i.alt.trim() === '').length);
    if (badImgs > 0) {
      addFinding('warning', `${badImgs} imagem(ns) sem atributo alt`, 'Imagens sem alt prejudicam acessibilidade e leitores de tela.');
      suggestions.push('Adicione atributos alt descritivos em todas as imagens.');
    }
  });

  // 5. Formulários sem labels
  await step('Verificando acessibilidade dos formulários', async () => {
    const unlabeledInputs = await page.$$eval('input:not([type="hidden"]):not([type="submit"]):not([type="button"])', inputs => {
      return inputs.filter(input => {
        const id = input.id;
        const hasLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
        const hasAriaLabel = !!input.getAttribute('aria-label') || !!input.getAttribute('aria-labelledby');
        return !hasLabel && !hasAriaLabel;
      }).length;
    });
    if (unlabeledInputs > 0) {
      addFinding('critical', `${unlabeledInputs} campo(s) sem label acessível`, 'Campos sem label tornam o formulário inacessível para tecnologias assistivas.');
      suggestions.push('Associe cada campo de formulário a um <label> com o atributo for correspondente.');
    }
  });

  // 6. Links com href vazio
  await step('Verificando links quebrados e âncoras vazias', async () => {
    const badLinks = await page.$$eval('a', links => links.filter(a => !a.href || a.href === '#' || a.href === window.location.href + '#').length);
    if (badLinks > 0) {
      addFinding('warning', `${badLinks} link(s) com href vazio ou âncora inválida`, 'Links sem destino são considerados broken links e prejudicam UX e SEO.');
      suggestions.push('Verifique e corrija todos os links sem href válido.');
    }
  });

  // 7. Console errors
  await step('Verificando erros de console JavaScript', async () => {
    // Wait a bit to collect more errors
    await page.waitForTimeout(1000);
    if (consoleErrors.length > 0) {
      addFinding('critical', `${consoleErrors.length} erro(s) de JavaScript no console`, consoleErrors.slice(0, 3).join(' | '));
      suggestions.push('Corrija os erros de JavaScript que aparecem no console do navegador.');
    }
  });

  // 8. Contraste básico — check for text-on-white with very light colors
  await step('Verificando contraste de texto (WCAG básico)', async () => {
    const lowContrast = await page.$$eval('p, h1, h2, h3, h4, span, a, label', els => {
      return els.filter(el => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return false;
        const [, r, g, b] = match.map(Number);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.85; // Very light text — likely poor contrast
      }).length;
    });
    if (lowContrast > 3) {
      addFinding('warning', 'Possível problema de contraste de texto', `${lowContrast} elemento(s) com texto muito claro. Verifique conformidade WCAG 2.1 AA (ratio 4.5:1).`);
      suggestions.push('Verifique o contraste de cor em todos os textos utilizando uma ferramenta WCAG.');
    }
  });

  // 9. Viewport meta
  await step('Verificando configuração de viewport (responsividade)', async () => {
    const viewportMeta = await page.$('meta[name="viewport"]');
    if (!viewportMeta) {
      addFinding('critical', 'Meta viewport ausente', 'Sem meta viewport, a página não é responsiva em dispositivos móveis.');
      suggestions.push('Adicione <meta name="viewport" content="width=device-width, initial-scale=1">.');
    }
  });

  // 10. HTTPS check
  await step('Verificando uso de HTTPS', async () => {
    if (url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
      addFinding('critical', 'Site sem HTTPS', 'O site está sendo servido via HTTP. Dados dos usuários não estão criptografados.');
      suggestions.push('Configure um certificado SSL/TLS e redirecione todo o tráfego HTTP para HTTPS.');
    }
  });

  // 11. Favicon
  await step('Verificando favicon', async () => {
    const favicon = await page.$('link[rel*="icon"]');
    if (!favicon) {
      addFinding('info', 'Favicon não encontrado', 'A página não possui favicon configurado.');
      suggestions.push('Adicione um favicon.ico ou <link rel="icon"> para melhorar a identidade visual.');
    }
  });

  // 12. Performance — checar imagens grandes
  await step('Verificando tamanho de imagens (performance)', async () => {
    const largeImages = await page.$$eval('img', imgs => {
      return imgs.filter(img => {
        const rect = img.getBoundingClientRect();
        return img.naturalWidth > 1920 || (rect.width > 0 && img.naturalWidth / rect.width > 3);
      }).length;
    });
    if (largeImages > 0) {
      addFinding('warning', `${largeImages} imagem(ns) com resolução excessiva`, 'Imagens maiores que necessário aumentam o tempo de carregamento desnecessariamente.');
      suggestions.push('Otimize imagens para o tamanho real exibido e use formatos modernos como WebP.');
    }
  });

  // 13. Botões sem texto acessível
  await step('Verificando botões com texto acessível', async () => {
    const badButtons = await page.$$eval('button, [role="button"]', btns => {
      return btns.filter(btn => {
        const text = btn.textContent?.trim();
        const label = btn.getAttribute('aria-label') || btn.getAttribute('title');
        return !text && !label;
      }).length;
    });
    if (badButtons > 0) {
      addFinding('warning', `${badButtons} botão(ões) sem texto ou aria-label`, 'Botões sem texto são inacessíveis para usuários de leitores de tela.');
      suggestions.push('Adicione texto visível ou aria-label a todos os botões.');
    }
  });

  // 14. Screenshot final da página
  await step('Capturando screenshot da página', async () => {
    await page.screenshot({ fullPage: true });
  });

  // Calculate score: 100 - weighted penalty
  const penalty = criticalCount * 15 + warningCount * 5 + infoCount * 1;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  if (suggestions.length === 0) {
    suggestions.push('A página passou em todas as verificações automáticas. Continue monitorando com regularidade.');
  }

  return { findings, suggestions, score };
}

module.exports = { startExecution, stopExecution };
