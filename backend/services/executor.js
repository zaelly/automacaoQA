const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const { supabase, findOne, findAll } = require('../db');

const WORKSPACE = path.join(__dirname, '..', 'workspace');

const running = new Map();

function getWorkspacePaths(executionId) {
  const dir = path.join(WORKSPACE, executionId);
  fs.mkdirSync(path.join(dir, 'videos'), { recursive: true });
  return { dir, videos: path.join(dir, 'videos') };
}

function broadcast(executionId, payload) {
  if (global.broadcast) global.broadcast(executionId, payload);
}

async function updateExecution(id, fields) {
  const { error } = await supabase.from('executions').update(fields).eq('id', id);
  if (error) console.error('[executor] updateExecution error:', error.message);
}

async function saveStep(executionId, { name, status, errorMessage = null, durationMs = 0, orderIndex = 0 }) {
  const stepId = uuid();
  const { error } = await supabase.from('execution_steps').insert({
    id: stepId,
    execution_id: executionId,
    name,
    status,
    error_message: errorMessage,
    duration_ms: durationMs,
    order_index: orderIndex,
  });
  if (error) console.error('[executor] saveStep error:', error.message);
  return stepId;
}

async function startExecution(executionId, options = {}) {
  const exec = await findOne('executions', { id: executionId });
  if (!exec) throw new Error('Execução não encontrada');

  const { dir, videos } = getWorkspacePaths(executionId);

  let stopped = false;
  running.set(executionId, { stop: () => { stopped = true; } });

  await updateExecution(executionId, { status: 'running' });
  broadcast(executionId, { type: 'started' });

  const startTime = Date.now();
  let browser, context, page;

  try {
    browser = await chromium.launch({ headless: true });

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
        await saveStep(executionId, { name, status: 'passed', durationMs: dur, orderIndex: stepIndex });
        broadcast(executionId, { type: 'step_pass', name, index: stepIndex, durationMs: dur });
      } catch (err) {
        if (err.message === 'STOPPED') throw err;
        const dur = Date.now() - t0;
        failedSteps++;
        await saveStep(executionId, { name, status: 'failed', errorMessage: err.message, durationMs: dur, orderIndex: stepIndex });
        broadcast(executionId, { type: 'step_fail', name, index: stepIndex, error: err.message, durationMs: dur });
      }
      return { passedSteps, failedSteps };
    };

    const flow = exec.flow_id ? await findOne('flows', { id: exec.flow_id }) : null;

    let findings = [], suggestions = [], score = null;

    if (flow) {
      const [testUser = null] = exec.flow_id
        ? await findAll('test_users', { project_id: exec.project_id }, { limit: 1 })
        : [];
      await runFlowScript(flow.script, page, {
        baseUrl: exec.base_url,
        testUser: testUser || { username: '', password: '' },
        step,
      });
      score = failedSteps === 0 ? 100 : Math.round((passedSteps / Math.max(totalSteps, 1)) * 100);
    } else {
      const result = await runAIAudit(page, exec.base_url, step, consoleErrors, options.credentials || null);
      findings    = result.findings;
      suggestions = result.suggestions;
      score       = result.score;
    }

    let videoPath = null;
    if (options.recordVideo) {
      const videoFile = await page.video()?.path();
      if (videoFile) videoPath = path.relative(WORKSPACE, videoFile);
    }

    await context.close();
    await browser.close();

    const status    = failedSteps === 0 ? 'passed' : (passedSteps === 0 ? 'failed' : 'passed');
    const durationMs = Date.now() - startTime;

    await updateExecution(executionId, {
      status,
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      total_steps: totalSteps,
      passed_steps: passedSteps,
      failed_steps: failedSteps,
      score,
      findings:    JSON.stringify(findings),
      suggestions: JSON.stringify(suggestions),
      video_path:  videoPath,
    });

    broadcast(executionId, { type: 'finished', status, score, durationMs, passedSteps, failedSteps, findings, suggestions });
  } catch (err) {
    try { await context?.close(); } catch (_) {}
    try { await browser?.close(); } catch (_) {}

    if (err.message === 'STOPPED') {
      await updateExecution(executionId, { status: 'stopped', finished_at: new Date().toISOString(), duration_ms: Date.now() - startTime });
      broadcast(executionId, { type: 'finished', status: 'stopped' });
    } else {
      await updateExecution(executionId, { status: 'failed', finished_at: new Date().toISOString(), duration_ms: Date.now() - startTime });
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
    const wrappedScript = `(async function(page, context) {
      const { baseUrl, testUser, step } = context;
      ${script.replace(/^async function flow[^{]+\{/, '').replace(/\}$/, '')}
    })`;
    const fn = eval(wrappedScript); // eslint-disable-line no-eval
    await fn(page, context);
  } catch (err) {
    if (err.message === 'STOPPED') throw err;
    broadcast('', { type: 'script_error', error: err.message });
  }
}

// ─── AI Audit mode ──────────────────────────────────────────────────────────
async function runAIAudit(page, url, step, consoleErrors, credentials = null) {
  const findings    = [];
  const suggestions = [];
  let criticalCount = 0, warningCount = 0, infoCount = 0;

  const addFinding = (type, title, desc) => {
    findings.push({ type, title, desc });
    if (type === 'critical') criticalCount++;
    else if (type === 'warning') warningCount++;
    else infoCount++;
  };

  await step('Carregando a URL alvo', async () => {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!resp || resp.status() >= 400) {
      addFinding('critical', 'URL inacessível', `O servidor retornou status ${resp?.status()} para ${url}`);
    }
  });

  // ─── Login with credentials if provided ────────────────────────────────────
  if (credentials && (credentials.email || credentials.username) && credentials.password) {
    await step('Realizando login na aplicação', async () => {
      const loginValue = credentials.email || credentials.username;

      const emailInput = await page.$(
        'input[type="email"], input[name="email"], input[name="login"], input[name="username"], ' +
        'input[id*="email" i], input[id*="user" i], input[placeholder*="email" i], input[placeholder*="usuário" i], input[placeholder*="usuario" i]'
      );
      if (emailInput) await emailInput.fill(loginValue);

      const passInput = await page.$('input[type="password"]');
      if (passInput) await passInput.fill(credentials.password);

      const submitBtn = await page.$(
        'button[type="submit"], input[type="submit"], ' +
        'button:has-text("Login"), button:has-text("Entrar"), button:has-text("Sign in"), button:has-text("Acessar")'
      );
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      }
    });
  }

  await step('Verificando título da página', async () => {
    const title = await page.title();
    if (!title || title.trim() === '') {
      addFinding('warning', 'Título ausente', 'A página não possui tag <title> definida, o que prejudica SEO e acessibilidade.');
      suggestions.push('Adicione uma tag <title> descritiva em cada página.');
    }
  });

  await step('Verificando meta description (SEO)', async () => {
    const metaDesc = await page.$('meta[name="description"]');
    if (!metaDesc) {
      addFinding('info', 'Meta description ausente', 'Nenhuma meta description encontrada. Importante para SEO.');
      suggestions.push('Adicione <meta name="description" content="..."> a cada página.');
    }
  });

  await step('Verificando imagens sem atributo alt', async () => {
    const badImgs = await page.$$eval('img', imgs => imgs.filter(i => !i.alt || i.alt.trim() === '').length);
    if (badImgs > 0) {
      addFinding('warning', `${badImgs} imagem(ns) sem atributo alt`, 'Imagens sem alt prejudicam acessibilidade e leitores de tela.');
      suggestions.push('Adicione atributos alt descritivos em todas as imagens.');
    }
  });

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

  await step('Verificando links quebrados e âncoras vazias', async () => {
    const badLinks = await page.$$eval('a', links => links.filter(a => !a.href || a.href === '#' || a.href === window.location.href + '#').length);
    if (badLinks > 0) {
      addFinding('warning', `${badLinks} link(s) com href vazio ou âncora inválida`, 'Links sem destino são considerados broken links e prejudicam UX e SEO.');
      suggestions.push('Verifique e corrija todos os links sem href válido.');
    }
  });

  await step('Verificando erros de console JavaScript', async () => {
    await page.waitForTimeout(1000);
    if (consoleErrors.length > 0) {
      addFinding('critical', `${consoleErrors.length} erro(s) de JavaScript no console`, consoleErrors.slice(0, 3).join(' | '));
      suggestions.push('Corrija os erros de JavaScript que aparecem no console do navegador.');
    }
  });

  await step('Verificando contraste de texto (WCAG básico)', async () => {
    const lowContrast = await page.$$eval('p, h1, h2, h3, h4, span, a, label', els => {
      return els.filter(el => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return false;
        const [, r, g, b] = match.map(Number);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.85;
      }).length;
    });
    if (lowContrast > 3) {
      addFinding('warning', 'Possível problema de contraste de texto', `${lowContrast} elemento(s) com texto muito claro. Verifique conformidade WCAG 2.1 AA (ratio 4.5:1).`);
      suggestions.push('Verifique o contraste de cor em todos os textos utilizando uma ferramenta WCAG.');
    }
  });

  await step('Verificando configuração de viewport (responsividade)', async () => {
    const viewportMeta = await page.$('meta[name="viewport"]');
    if (!viewportMeta) {
      addFinding('critical', 'Meta viewport ausente', 'Sem meta viewport, a página não é responsiva em dispositivos móveis.');
      suggestions.push('Adicione <meta name="viewport" content="width=device-width, initial-scale=1">.');
    }
  });

  await step('Verificando uso de HTTPS', async () => {
    if (url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
      addFinding('critical', 'Site sem HTTPS', 'O site está sendo servido via HTTP. Dados dos usuários não estão criptografados.');
      suggestions.push('Configure um certificado SSL/TLS e redirecione todo o tráfego HTTP para HTTPS.');
    }
  });

  await step('Verificando favicon', async () => {
    const favicon = await page.$('link[rel*="icon"]');
    if (!favicon) {
      addFinding('info', 'Favicon não encontrado', 'A página não possui favicon configurado.');
      suggestions.push('Adicione um favicon.ico ou <link rel="icon"> para melhorar a identidade visual.');
    }
  });

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

  const penalty = criticalCount * 15 + warningCount * 5 + infoCount * 1;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  if (suggestions.length === 0) {
    suggestions.push('A página passou em todas as verificações automáticas. Continue monitorando com regularidade.');
  }

  return { findings, suggestions, score };
}

module.exports = { startExecution, stopExecution };
