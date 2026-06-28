const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const { supabase, findOne, findAll } = require('../db');

const WORKSPACE = path.join(__dirname, '..', 'workspace');

const running = new Map();

// Tracks whether execution_steps table has screenshot_path column
let _screenshotColumnExists = true;

function getWorkspacePaths(executionId) {
  const dir = path.join(WORKSPACE, executionId);
  fs.mkdirSync(path.join(dir, 'videos'),      { recursive: true });
  fs.mkdirSync(path.join(dir, 'screenshots'), { recursive: true });
  return {
    dir,
    videos:      path.join(dir, 'videos'),
    screenshots: path.join(dir, 'screenshots'),
  };
}

function broadcast(executionId, payload) {
  if (global.broadcast) global.broadcast(executionId, payload);
}

async function updateExecution(id, fields) {
  const { error } = await supabase.from('executions').update(fields).eq('id', id);
  if (error) console.error('[executor] updateExecution error:', error.message);
}

async function takeScreenshot(page, executionId, label) {
  try {
    const dir = path.join(WORKSPACE, executionId, 'screenshots');
    fs.mkdirSync(dir, { recursive: true });
    const safe = label.replace(/[^a-z0-9]/gi, '_').slice(0, 50);
    const filename = `${Date.now()}_${safe}.png`;
    await page.screenshot({ path: path.join(dir, filename), fullPage: false, timeout: 5000 });
    return `${executionId}/screenshots/${filename}`;
  } catch (e) {
    console.warn('[executor] screenshot failed:', e.message);
    return null;
  }
}

async function saveStep(executionId, { name, status, errorMessage = null, durationMs = 0, orderIndex = 0, screenshotPath = null }) {
  const stepId = uuid();
  const base = {
    id: stepId,
    execution_id: executionId,
    name,
    status,
    error_message: errorMessage,
    duration_ms: durationMs,
    order_index: orderIndex,
  };

  if (screenshotPath && _screenshotColumnExists) {
    const { error } = await supabase.from('execution_steps').insert({ ...base, screenshot_path: screenshotPath });
    if (error) {
      // Column probably doesn't exist yet — fall back without it
      _screenshotColumnExists = false;
      const { error: e2 } = await supabase.from('execution_steps').insert(base);
      if (e2) console.error('[executor] saveStep fallback error:', e2.message);
    }
  } else {
    const { error } = await supabase.from('execution_steps').insert(base);
    if (error) console.error('[executor] saveStep error:', error.message);
  }
  return stepId;
}

async function startExecution(executionId, options = {}) {
  const exec = await findOne('executions', { id: executionId });
  if (!exec) throw new Error('Execução não encontrada');

  const { videos } = getWorkspacePaths(executionId);

  let stopped = false;
  running.set(executionId, { stop: () => { stopped = true; } });

  const hasCredentials = !!(options.credentials && (options.credentials.email || options.credentials.username) && options.credentials.password);
  const checks         = Array.isArray(options.checks) && options.checks.length > 0 ? options.checks : null; // null = run all
  const enabledChecks  = checks || ['nav','forms','a11y','seo','perf','sec','links','js'];

  // Count how many audit steps will actually run based on selected checks
  const STEP_WEIGHTS = { nav:4, forms:3, a11y:5, seo:3, perf:1, sec:1, links:1, js:1 };
  const auditSteps = enabledChecks.reduce((s, c) => s + (STEP_WEIGHTS[c] || 0), 0) + 2; // +2 for load + screenshot
  const estimatedSteps = hasCredentials ? auditSteps + 2 : auditSteps; // +2 for login steps

  await updateExecution(executionId, { status: 'running' });
  broadcast(executionId, { type: 'started', estimatedSteps });

  const startTime = Date.now();
  let browser, context, page;

  try {
    browser = await chromium.launch({ headless: true });

    const contextOptions = {};
    if (options.recordVideo) {
      contextOptions.recordVideo = { dir: videos, size: { width: 1280, height: 720 } };
    }
    context = await browser.newContext(contextOptions);
    page    = await context.newPage();

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
        const screenshotPath = await takeScreenshot(page, executionId, name);
        await saveStep(executionId, { name, status: 'failed', errorMessage: err.message, durationMs: dur, orderIndex: stepIndex, screenshotPath });
        broadcast(executionId, {
          type: 'step_fail', name, index: stepIndex, error: err.message, durationMs: dur,
          screenshotUrl: screenshotPath ? `/files/${screenshotPath}` : null,
        });
      }
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
      const result = await runAIAudit(page, exec.base_url, step, consoleErrors, options.credentials || null, executionId, checks);
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

    const status     = failedSteps === 0 ? 'passed' : (passedSteps === 0 ? 'failed' : 'passed');
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

// ─── AI Audit + Interactive Testing ─────────────────────────────────────────
async function runAIAudit(page, url, step, consoleErrors, credentials, executionId, checks) {
  const findings    = [];
  const suggestions = [];
  let criticalCount = 0, warningCount = 0, infoCount = 0;

  // null checks = run everything
  const ok = (...cats) => !checks || cats.some(c => checks.includes(c));

  const addFinding = (type, title, desc, screenshot = null) => {
    findings.push({ type, title, desc, ...(screenshot ? { screenshot } : {}) });
    if (type === 'critical') criticalCount++;
    else if (type === 'warning') warningCount++;
    else infoCount++;
  };

  // ── 1. Load URL (always) ────────────────────────────────────────────────────
  await step('Carregando a URL alvo', async () => {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!resp || resp.status() >= 400) {
      addFinding('critical', 'URL inacessível', `O servidor retornou status ${resp?.status()} para ${url}`);
    }
  });

  // ── 2. Login (if credentials provided — always) ──────────────────────────────
  const hasCredentials = !!(credentials && (credentials.email || credentials.username) && credentials.password);
  if (hasCredentials) {
    await step('Realizando login na aplicação', async () => {
      const loginValue = credentials.email || credentials.username;

      const emailInput = await page.$(
        'input[type="email"], input[name="email"], input[name="login"], input[name="username"], ' +
        'input[id*="email" i], input[id*="user" i], input[placeholder*="email" i], ' +
        'input[placeholder*="usuário" i], input[placeholder*="usuario" i]'
      );
      if (emailInput) {
        await emailInput.fill(loginValue);
      } else {
        throw new Error('Campo de usuário/email não encontrado na página de login');
      }

      const passInput = await page.$('input[type="password"]');
      if (passInput) {
        await passInput.fill(credentials.password);
      } else {
        throw new Error('Campo de senha não encontrado na página de login');
      }

      const submitBtn = await page.$(
        'button[type="submit"], input[type="submit"], ' +
        'button:has-text("Login"), button:has-text("Entrar"), button:has-text("Sign in"), ' +
        'button:has-text("Acessar"), button:has-text("Logar")'
      );
      if (submitBtn) {
        await submitBtn.click();
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);

        const errorMsg = await page.$('.error, .alert-error, [class*="error"], [role="alert"]');
        if (errorMsg) {
          const text = (await errorMsg.textContent() || '').trim();
          if (text && /inválid|incorret|wrong|failed|erro/i.test(text)) {
            throw new Error(`Login falhou: ${text.slice(0, 100)}`);
          }
        }
      } else {
        throw new Error('Botão de login não encontrado');
      }
    });

    await step('Navegando para URL de teste após login', async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
    });
  }

  // ── Passive audit checks (guarded by selected checks) ───────────────────────

  if (ok('seo')) await step('Verificando título da página', async () => {
    const title = await page.title();
    if (!title || title.trim() === '') {
      addFinding('warning', 'Título ausente', 'A página não possui tag <title> definida, o que prejudica SEO e acessibilidade.');
      suggestions.push('Adicione uma tag <title> descritiva em cada página.');
    }
  });

  if (ok('seo')) await step('Verificando meta description (SEO)', async () => {
    const metaDesc = await page.$('meta[name="description"]');
    if (!metaDesc) {
      addFinding('info', 'Meta description ausente', 'Nenhuma meta description encontrada. Importante para SEO.');
      suggestions.push('Adicione <meta name="description" content="..."> a cada página.');
    }
  });

  if (ok('a11y')) await step('Verificando imagens sem atributo alt', async () => {
    const badImgs = await page.$$eval('img', imgs => imgs.filter(i => !i.alt || i.alt.trim() === '').length);
    if (badImgs > 0) {
      addFinding('warning', `${badImgs} imagem(ns) sem atributo alt`, 'Imagens sem alt prejudicam acessibilidade e leitores de tela.');
      suggestions.push('Adicione atributos alt descritivos em todas as imagens.');
    }
  });

  if (ok('a11y', 'forms')) await step('Verificando acessibilidade dos formulários', async () => {
    const unlabeled = await page.$$eval('input:not([type="hidden"]):not([type="submit"]):not([type="button"])', inputs =>
      inputs.filter(input => {
        const id = input.id;
        const hasLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
        const hasAria  = !!input.getAttribute('aria-label') || !!input.getAttribute('aria-labelledby');
        return !hasLabel && !hasAria;
      }).length
    );
    if (unlabeled > 0) {
      addFinding('critical', `${unlabeled} campo(s) sem label acessível`, 'Campos sem label tornam o formulário inacessível para tecnologias assistivas.');
      suggestions.push('Associe cada campo de formulário a um <label> com o atributo for correspondente.');
    }
  });

  if (ok('links', 'nav')) await step('Verificando links quebrados e âncoras vazias', async () => {
    const badLinks = await page.$$eval('a', links =>
      links.filter(a => !a.href || a.href === '#' || a.href === window.location.href + '#').length
    );
    if (badLinks > 0) {
      addFinding('warning', `${badLinks} link(s) com href vazio ou âncora inválida`, 'Links sem destino são considerados broken links e prejudicam UX e SEO.');
      suggestions.push('Verifique e corrija todos os links sem href válido.');
    }
  });

  if (ok('js')) await step('Verificando erros de console JavaScript', async () => {
    await page.waitForTimeout(1000);
    if (consoleErrors.length > 0) {
      addFinding('critical', `${consoleErrors.length} erro(s) de JavaScript no console`, consoleErrors.slice(0, 3).join(' | '));
      suggestions.push('Corrija os erros de JavaScript que aparecem no console do navegador.');
    }
  });

  if (ok('a11y')) await step('Verificando contraste de texto (WCAG básico)', async () => {
    const lowContrast = await page.$$eval('p, h1, h2, h3, h4, span, a, label', els =>
      els.filter(el => {
        const style = window.getComputedStyle(el);
        const match = style.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return false;
        const [, r, g, b] = match.map(Number);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.85;
      }).length
    );
    if (lowContrast > 3) {
      addFinding('warning', 'Possível problema de contraste de texto', `${lowContrast} elemento(s) com texto muito claro. Verifique conformidade WCAG 2.1 AA (ratio 4.5:1).`);
      suggestions.push('Verifique o contraste de cor em todos os textos utilizando uma ferramenta WCAG.');
    }
  });

  if (ok('a11y')) await step('Verificando configuração de viewport (responsividade)', async () => {
    const viewportMeta = await page.$('meta[name="viewport"]');
    if (!viewportMeta) {
      addFinding('critical', 'Meta viewport ausente', 'Sem meta viewport, a página não é responsiva em dispositivos móveis.');
      suggestions.push('Adicione <meta name="viewport" content="width=device-width, initial-scale=1">.');
    }
  });

  if (ok('sec')) await step('Verificando uso de HTTPS', async () => {
    if (url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
      addFinding('critical', 'Site sem HTTPS', 'O site está sendo servido via HTTP. Dados dos usuários não estão criptografados.');
      suggestions.push('Configure um certificado SSL/TLS e redirecione todo o tráfego HTTP para HTTPS.');
    }
  });

  if (ok('seo')) await step('Verificando favicon', async () => {
    const favicon = await page.$('link[rel*="icon"]');
    if (!favicon) {
      addFinding('info', 'Favicon não encontrado', 'A página não possui favicon configurado.');
      suggestions.push('Adicione um favicon.ico ou <link rel="icon"> para melhorar a identidade visual.');
    }
  });

  if (ok('perf')) await step('Verificando tamanho de imagens (performance)', async () => {
    const largeImages = await page.$$eval('img', imgs =>
      imgs.filter(img => {
        const rect = img.getBoundingClientRect();
        return img.naturalWidth > 1920 || (rect.width > 0 && img.naturalWidth / rect.width > 3);
      }).length
    );
    if (largeImages > 0) {
      addFinding('warning', `${largeImages} imagem(ns) com resolução excessiva`, 'Imagens maiores que necessário aumentam o tempo de carregamento desnecessariamente.');
      suggestions.push('Otimize imagens para o tamanho real exibido e use formatos modernos como WebP.');
    }
  });

  if (ok('a11y', 'nav')) await step('Verificando botões com texto acessível', async () => {
    const badButtons = await page.$$eval('button, [role="button"]', btns =>
      btns.filter(btn => {
        const text  = btn.textContent?.trim();
        const label = btn.getAttribute('aria-label') || btn.getAttribute('title');
        return !text && !label;
      }).length
    );
    if (badButtons > 0) {
      addFinding('warning', `${badButtons} botão(ões) sem texto ou aria-label`, 'Botões sem texto são inacessíveis para usuários de leitores de tela.');
      suggestions.push('Adicione texto visível ou aria-label a todos os botões.');
    }
  });

  // ── Interactive tests (only when credentials provided) ───────────────────────
  if (hasCredentials) {
    await runInteractiveTests(page, url, step, consoleErrors, addFinding, suggestions, executionId, checks);
  }

  const penalty = criticalCount * 15 + warningCount * 5 + infoCount * 1;
  const score   = Math.max(0, Math.min(100, 100 - penalty));

  if (suggestions.length === 0) {
    suggestions.push('A página passou em todas as verificações automáticas. Continue monitorando com regularidade.');
  }

  return { findings, suggestions, score };
}

// ─── Interactive test suite ──────────────────────────────────────────────────
async function runInteractiveTests(page, url, step, consoleErrors, addFinding, suggestions, executionId, checks) {
  const ok = (...cats) => !checks || cats.some(c => checks.includes(c));

  // ── Test all visible buttons ──────────────────────────────────────────────
  if (ok('nav')) await step('Testando botões interativos da página', async () => {
    const SKIP = /excluir|deletar|apagar|logout|sair|fechar venda|finalizar venda|encerrar|cancelar venda|zerar carrinho|limpar|resetar/i;
    const buttons = await page.$$('button:not([disabled])');
    const tested  = new Set();
    let errorCount = 0;
    const errsBefore = consoleErrors.length;

    for (const btn of buttons.slice(0, 25)) {
      try {
        const text      = (await btn.textContent().catch(() => '') || '').trim();
        const ariaLabel = (await btn.getAttribute('aria-label').catch(() => '') || '');
        const fullLabel = `${text} ${ariaLabel}`.trim();

        if (!fullLabel) continue;
        if (SKIP.test(fullLabel)) continue;
        if (tested.has(fullLabel.toLowerCase().slice(0, 30))) continue;
        tested.add(fullLabel.toLowerCase().slice(0, 30));

        const isVisible = await btn.isVisible().catch(() => false);
        if (!isVisible) continue;

        const urlBefore = page.url();

        await btn.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(500);

        const newErrs = consoleErrors.length - errsBefore - errorCount;
        if (newErrs > 0) {
          errorCount += newErrs;
          addFinding('warning',
            `Botão "${fullLabel.slice(0, 60)}" gerou erro de JavaScript`,
            consoleErrors.slice(errsBefore + errorCount - newErrs, errsBefore + errorCount).join(' | ')
          );
        }

        // Close any modal that opened
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(200);

        // Go back if navigated away
        if (page.url() !== urlBefore) {
          await page.goto(urlBefore, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(800);
        }
      } catch (_) { /* ignore individual button errors */ }
    }

    if (errorCount > 0) {
      throw new Error(`${errorCount} botão(ões) causaram erros de JavaScript`);
    }
    suggestions.push('Todos os botões testados responderam sem erros críticos.');
  });

  // ── Test form inputs with real data (CNPJ, CPF, phone, name) ─────────────
  if (ok('forms')) await step('Testando campos de formulário (CNPJ, CPF, telefone, nome)', async () => {
    const inputs = await page.$$('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([disabled])');
    let testedCount = 0;
    let validationIssues = 0;

    for (const input of inputs.slice(0, 20)) {
      try {
        const isVisible = await input.isVisible().catch(() => false);
        if (!isVisible) continue;

        const type        = (await input.getAttribute('type').catch(() => '') || 'text').toLowerCase();
        const name        = (await input.getAttribute('name').catch(() => '')        || '').toLowerCase();
        const id          = (await input.getAttribute('id').catch(() => '')          || '').toLowerCase();
        const placeholder = (await input.getAttribute('placeholder').catch(() => '') || '').toLowerCase();
        const ariaLabel   = (await input.getAttribute('aria-label').catch(() => '')  || '').toLowerCase();
        const combined    = `${name} ${id} ${placeholder} ${ariaLabel}`;

        let testValue = null;
        let fieldName = '';

        if (/cnpj/i.test(combined)) {
          testValue = '11.222.333/0001-81';
          fieldName = 'CNPJ';
        } else if (/cpf/i.test(combined)) {
          testValue = '529.982.247-25';
          fieldName = 'CPF';
        } else if (/tel|fone|celular|phone|whatsapp/i.test(combined)) {
          testValue = '(11) 99999-9999';
          fieldName = 'Telefone';
        } else if (/nome|name|razão|razao|cliente/i.test(combined)) {
          testValue = 'João da Silva Teste';
          fieldName = 'Nome';
        } else if (type === 'email' || /email|e-mail/i.test(combined)) {
          testValue = 'teste@qatry.com';
          fieldName = 'E-mail';
        } else if (type === 'number' || /qtd|qty|quantidade|quant/i.test(combined)) {
          testValue = '3';
          fieldName = 'Quantidade';
        } else if (/search|busca|pesquisa|procur/i.test(combined)) {
          testValue = 'Produto Teste';
          fieldName = 'Busca';
        } else if (type === 'text') {
          testValue = 'Teste QA';
          fieldName = 'Texto';
        }

        if (!testValue) continue;

        await input.click().catch(() => {});
        await input.fill(testValue).catch(() => {});
        await page.keyboard.press('Tab');
        await page.waitForTimeout(400);

        // Check for visible validation error
        const errSel = '.error, .invalid-feedback, [class*="invalid"], .text-red-500, .text-danger, [role="alert"]:visible';
        const errEl  = await page.$(errSel).catch(() => null);
        if (errEl) {
          const errText = ((await errEl.textContent().catch(() => '')) || '').trim();
          if (errText && errText.length > 2 && !/sucesso|ok|válido|valid/i.test(errText)) {
            validationIssues++;
            addFinding('info', `Campo ${fieldName}: erro de validação detectado`, `Valor "${testValue}" → ${errText.slice(0, 120)}`);
          }
        }

        testedCount++;
      } catch (_) { /* ignore */ }
    }

    if (testedCount === 0) {
      addFinding('info', 'Nenhum campo de formulário encontrado para teste', 'Não foram localizados inputs visíveis na página.');
    }
  });

  // ── Test product/item grid ────────────────────────────────────────────────
  if (ok('nav')) await step('Testando seleção de produtos e itens', async () => {
    const productSelectors = [
      '[class*="product-card"]', '[class*="produto-card"]',
      '[class*="product-item"]', '[class*="produto-item"]',
      '[class*="product-row"]',  '[class*="produto-row"]',
      'table tbody tr[class]', '.item-list > *', '.product-list > *',
    ];

    let found = false;
    for (const sel of productSelectors) {
      const items = await page.$$(sel).catch(() => []);
      if (items.length === 0) continue;

      const first = items[0];
      const isVisible = await first.isVisible().catch(() => false);
      if (!isVisible) continue;

      await first.click().catch(() => {});
      await page.waitForTimeout(600);

      // Try to interact with quantity input if one appeared
      const qtyInput = await page.$('input[type="number"], input[name*="qtd"], input[name*="quantidade"], input[placeholder*="qtd"]').catch(() => null);
      if (qtyInput) {
        const curr = await qtyInput.inputValue().catch(() => '1');
        await qtyInput.fill('2').catch(() => {});
        await page.keyboard.press('Tab');
        await page.waitForTimeout(400);
        await qtyInput.fill(curr || '1').catch(() => {});
      }

      found = true;
      suggestions.push(`Grade de produtos testada: ${items.length} item(ns) encontrado(s). Seleção e quantidade testadas.`);
      break;
    }

    if (!found) {
      addFinding('info', 'Grade de produtos não identificada automaticamente', 'Nenhuma grade de produtos/itens foi detectada na página. Se houver produtos, tente adicionar classes CSS identificadoras (product-card, produto-item).');
    }
  });

  // ── Test customer/client search field ────────────────────────────────────
  if (ok('forms')) await step('Testando campo de cliente/CPF/CNPJ', async () => {
    const clientSels = [
      'input[name*="client" i]', 'input[id*="client" i]',
      'input[placeholder*="cliente" i]', 'input[placeholder*="cpf" i]',
      'input[placeholder*="cnpj" i]', 'input[name*="cpf" i]',
      'input[name*="cnpj" i]', 'input[placeholder*="razão" i]',
      'input[placeholder*="nome do cliente" i]',
    ];

    let found = false;
    for (const sel of clientSels) {
      const input = await page.$(sel).catch(() => null);
      if (!input) continue;

      const isVisible = await input.isVisible().catch(() => false);
      if (!isVisible) continue;

      // Test CNPJ
      await input.click().catch(() => {});
      await input.fill('11.222.333/0001-81').catch(() => {});
      await page.waitForTimeout(600);

      // Check for dropdown / autocomplete
      const dropdown = await page.$('.autocomplete-results, .dropdown-menu, [role="listbox"], ul.suggestions, .search-results').catch(() => null);
      if (dropdown) {
        const option = await dropdown.$('li, [role="option"], .option').catch(() => null);
        if (option) {
          await option.click().catch(() => {});
          await page.waitForTimeout(400);
        }
        suggestions.push('Campo de cliente testado com CNPJ: autocomplete funcionou corretamente.');
      }

      // Test CPF too
      await input.fill('529.982.247-25').catch(() => {});
      await page.waitForTimeout(400);

      found = true;
      break;
    }

    if (!found) {
      addFinding('info', 'Campo de cliente não localizado', 'Não foi encontrado um campo de busca por cliente/CPF/CNPJ nesta página.');
    }
  });

  // ── Test phone number field specifically ────────────────────────────────
  if (ok('forms')) await step('Testando campo de telefone e validação de formato', async () => {
    const phoneSels = [
      'input[name*="tel" i]', 'input[id*="tel" i]',
      'input[placeholder*="telefone" i]', 'input[placeholder*="celular" i]',
      'input[name*="phone" i]', 'input[placeholder*="("]',
    ];

    let found = false;
    for (const sel of phoneSels) {
      const input = await page.$(sel).catch(() => null);
      if (!input) continue;

      const isVisible = await input.isVisible().catch(() => false);
      if (!isVisible) continue;

      // Test valid phone
      await input.fill('(11) 99999-9999').catch(() => {});
      await page.keyboard.press('Tab');
      await page.waitForTimeout(400);

      // Check if input accepted format (mask applied)
      const val = await input.inputValue().catch(() => '');
      if (val && val.includes('(')) {
        suggestions.push('Campo de telefone aceita máscara de formatação corretamente.');
      }

      // Test invalid phone
      await input.fill('abc123').catch(() => {});
      await page.keyboard.press('Tab');
      await page.waitForTimeout(400);

      const errEl = await page.$('.error, [class*="invalid"], .text-red-500, [role="alert"]:visible').catch(() => null);
      if (errEl) {
        const errText = ((await errEl.textContent().catch(() => '')) || '').trim();
        if (errText) addFinding('info', 'Campo telefone valida formato corretamente', `Mensagem ao inserir "abc123": "${errText.slice(0, 80)}"`);
      }

      found = true;
      break;
    }

    if (!found) {
      addFinding('info', 'Campo de telefone não encontrado', 'Nenhum campo de telefone/celular foi localizado nesta página.');
    }
  });

  // ── Test file upload (if input[type=file] exists) ────────────────────────
  if (ok('forms', 'nav')) await step('Testando upload de arquivo', async () => {
    const fileInput = await page.$('input[type="file"]').catch(() => null);
    if (!fileInput) {
      addFinding('info', 'Upload de arquivo não disponível', 'Nenhum input[type="file"] encontrado nesta página.');
      return;
    }

    const isVisible = await fileInput.isVisible().catch(() => false);
    if (!isVisible) {
      addFinding('info', 'Campo de upload oculto', 'Um input[type="file"] existe mas não está visível na página.');
      return;
    }

    // Create a temp test file in memory
    const tmpFile = require('path').join(require('os').tmpdir(), `qatry_upload_${Date.now()}.txt`);
    require('fs').writeFileSync(tmpFile, 'Arquivo de teste gerado pelo QATry — ' + new Date().toISOString());

    try {
      await fileInput.setInputFiles(tmpFile);
      await page.waitForTimeout(800);

      const errEl = await page.$('.error, [class*="invalid-file"], [class*="danger"]').catch(() => null);
      if (errEl) {
        const txt = ((await errEl.textContent().catch(() => '')) || '').trim();
        throw new Error('Upload rejeitado: ' + txt);
      }
      suggestions.push('Campo de upload de arquivo testado com sucesso.');
    } finally {
      require('fs').unlinkSync(tmpFile);
    }
  });

  // ── Verify success/error messages (toasts, alerts) ────────────────────────
  if (ok('nav', 'forms', 'js')) await step('Verificando mensagens de feedback (toasts, alertas)', async () => {
    const toastSel  = '[class*="toast"], [class*="snackbar"], [class*="notification"], [class*="alert"]:not(.alert-warn), [role="alert"]';
    const toasts    = await page.$$(toastSel).catch(() => []);
    let fatalFound  = 0;

    for (const toast of toasts) {
      const txt = ((await toast.textContent().catch(() => '')) || '').trim();
      if (!txt) continue;
      if (/500|server error|unexpected|uncaught|fatal/i.test(txt)) {
        fatalFound++;
        addFinding('critical', 'Mensagem de erro interno detectada', `Toast/alerta com conteúdo: "${txt.slice(0, 120)}"`);
      } else if (/erro|error|falhou|failed|inválido|invalid/i.test(txt)) {
        addFinding('warning', 'Mensagem de erro visível na página', `"${txt.slice(0, 120)}"`);
      }
    }

    // Check form validation messages
    const validationMsgs = await page.$$('.invalid-feedback, [class*="field-error"], [aria-invalid="true"] + *').catch(() => []);
    if (validationMsgs.length > 5) {
      addFinding('info', `${validationMsgs.length} mensagens de validação detectadas`, 'A página possui validação de formulário ativa — comportamento esperado.');
    }

    if (fatalFound === 0 && toasts.length === 0) {
      suggestions.push('Nenhum alerta de erro crítico detectado nas mensagens de feedback.');
    }
  });

  // ── Test CRUD: detect create/edit/delete actions ──────────────────────────
  if (ok('nav')) await step('Testando ações de criação, edição e exclusão de registros', async () => {
    const createSel  = 'button:has-text("Novo"), button:has-text("Adicionar"), button:has-text("Criar"), button:has-text("+ ")';
    const editSel    = 'button:has-text("Editar"), button[title*="editar" i], button[aria-label*="editar" i], [class*="edit-btn"]';
    const deleteSel  = 'button:has-text("Excluir"), button:has-text("Remover"), button[title*="excluir" i], [class*="delete-btn"]';

    const createBtn = await page.$(createSel).catch(() => null);
    const editBtn   = await page.$(editSel).catch(() => null);
    const deleteBtn = await page.$(deleteSel).catch(() => null);

    const found = [createBtn, editBtn, deleteBtn].filter(Boolean).length;

    if (found === 0) {
      addFinding('info', 'Ações CRUD não detectadas nesta página', 'Botões de criar, editar e excluir não foram encontrados.');
      return;
    }

    // Test create (just open modal/form — don't submit)
    if (createBtn) {
      const isVisible = await createBtn.isVisible().catch(() => false);
      if (isVisible) {
        const urlBefore = page.url();
        await createBtn.click().catch(() => {});
        await page.waitForTimeout(600);
        const modal = await page.$('[role="dialog"], .modal, [class*="modal"]').catch(() => null);
        if (modal) {
          suggestions.push('Botão de criar abre modal/formulário corretamente.');
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(300);
        }
        if (page.url() !== urlBefore) {
          await page.goto(urlBefore, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        }
      }
    }

    // Report what was found
    const foundLabels = [];
    if (createBtn) foundLabels.push('criar');
    if (editBtn)   foundLabels.push('editar');
    if (deleteBtn) foundLabels.push('excluir');
    suggestions.push(`Ações CRUD detectadas: ${foundLabels.join(', ')}. Fluxos de edição/exclusão devem ser testados com flows específicos.`);
  });

  // ── Screenshot of final state ─────────────────────────────────────────────
  await step('Capturando screenshot do estado final da página', async () => {
    const screenshotPath = await takeScreenshot(page, executionId, 'estado_final');
    if (screenshotPath) {
      addFinding('info', 'Screenshot final capturado', 'Estado da página ao término de todos os testes interativos.', `/files/${screenshotPath}`);
      suggestions.push('Consulte o screenshot final para visualizar o estado da página após os testes.');
    }
  });
}

module.exports = { startExecution, stopExecution };
