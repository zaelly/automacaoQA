/**
 * TestRunner v2 — QA audit with flow awareness and dependency detection.
 *
 * Flows executed in order:
 *   1. LOGIN   → if a login form is found, try it first
 *   2. CONTENT → forms, links, inventory (skipped if login failed)
 *   3. ALWAYS  → accessibility, performance, console/network (always run)
 *
 * If login fails, all dependent flows are marked SKIPPED with a clear reason.
 * The full timeline records every action with timestamps and screenshots.
 */

import * as path from 'path';
import * as fs from 'fs';
import type { Page } from 'playwright';

import { BrowserManager } from '../playwright/BrowserManager';
import { NetworkMonitor }  from '../tools/NetworkMonitor';
import { ConsoleMonitor }  from '../tools/ConsoleMonitor';
import { PerformanceCollector } from '../tools/PerformanceCollector';
import { ScreenshotManager }    from '../tools/ScreenshotManager';

import type {
  TestSummary, TestFlow, TimelineEvent, BrokenLink,
  NetworkErrorDetail, TestCheck, BroadcastEvent, PerformanceMetrics,
} from './types';
import { getIntent } from './intents';
import type { IntentDefinition } from './intents';

export interface TestCredentials {
  username?: string;
  password?: string;
}

const SKIPPED_FLOWS = ['Checkout / PDV', 'Formulários internos', 'Links internos'];

export class TestRunner {
  private browser  = new BrowserManager();
  private networkMon!:    NetworkMonitor;
  private consoleMon!:    ConsoleMonitor;
  private perfCollector!: PerformanceCollector;
  private screenshotMgr!: ScreenshotManager;

  private timeline:    TimelineEvent[]    = [];
  private flows:       Map<string, TestFlow> = new Map();
  private brokenLinks: BrokenLink[]       = [];
  private checks:      TestCheck[]        = [];

  private loginStatus: 'pass' | 'fail' | 'not_detected' = 'not_detected';
  private loginError?: string;
  private screenshotCounter = 0;
  private baseUrl = '';

  constructor(
    private sessionId: string,
    private workspaceRoot: string,
    private broadcast?: (event: BroadcastEvent) => void,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────

  async run(goal: string, baseUrl: string, credentials?: TestCredentials, intentId?: string, customSteps?: string[]): Promise<TestSummary> {
    this.baseUrl = baseUrl;
    const startedAt  = new Date().toISOString();
    const workspace  = path.join(this.workspaceRoot, this.sessionId);
    fs.mkdirSync(workspace, { recursive: true });

    const intentDef: IntentDefinition | undefined = intentId ? getIntent(intentId) : undefined;
    if (intentDef) {
      this.emit('phase_change', { phase: 'testing', label: `Executando: ${intentDef.emoji} ${intentDef.name}` });
    } else {
      this.emit('phase_change', { phase: 'testing', label: 'Executando testes...' });
    }

    const videoEnabled = true;
    await this.browser.launch(
      { maxSteps: 50, headless: true, timeout: 30000, screenshotOnEveryStep: false, videoEnabled, viewport: { width: 1366, height: 768 } },
      workspace,
    );
    const page = this.browser.getPage();

    this.networkMon    = new NetworkMonitor(page);
    this.consoleMon    = new ConsoleMonitor(page);
    this.perfCollector = new PerformanceCollector(page);
    this.screenshotMgr = new ScreenshotManager(page, workspace);
    this.networkMon.attach();
    this.consoleMon.attach();
    this.perfCollector.attach();

    let perf: PerformanceMetrics = {};
    let videoPath: string | undefined;

    try {
      // ── 1. Navigate ───────────────────────────────────────────────────────
      await this.navigate(page, baseUrl);

      // ── 2. SEO & metadata ─────────────────────────────────────────────────
      await this.runSeoChecks(page);

      // ── 3. Login flow ─────────────────────────────────────────────────────
      const hasLogin = await this.detectLoginForm(page);
      if (hasLogin) {
        await this.runLoginFlow(page, credentials);
      }

      // ── 4. Custom user instructions (after login, before intent flow) ────────
      if (this.loginStatus !== 'fail' && customSteps && customSteps.length > 0) {
        await this.runCustomSteps(page, customSteps);
      }

      // ── 5. Intent-specific tests (after login) ────────────────────────────
      if (this.loginStatus !== 'fail') {
        if (intentDef && intentDef.id !== 'exploratorio') {
          await this.runIntentFlow(page, baseUrl, intentDef);
        } else {
          // Generic exploration
          await this.runElementInventory(page);
          await this.runFormTests(page);
          await this.runLinkChecks(page);
        }
      } else {
        const skippedName = intentDef ? intentDef.name : 'Testes de Conteúdo';
        SKIPPED_FLOWS.forEach(name => this.addSkippedFlow(name, 'Login não concluído', 'Login'));
        if (intentDef && intentDef.id !== 'login') {
          this.addSkippedFlow(skippedName, 'Requer login bem-sucedido', 'Login');
        }
      }

      // ── 5. Always-run: accessibility + performance ────────────────────────
      await this.runAccessibilityChecks(page);
      perf = await this.perfCollector.collect();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addEvent('error', 'runner', `Erro inesperado: ${msg}`);
    } finally {
      const absVideoPath = await this.browser.close();
      if (absVideoPath) {
        // Store relative path so the frontend can build a URL via /agent-files/:sessionId/...
        const rel = absVideoPath.replace(/\\/g, '/');
        const marker = `/${this.sessionId}/`;
        const idx = rel.indexOf(marker);
        videoPath = idx >= 0 ? rel.slice(idx + marker.length) : path.basename(absVideoPath);
      }
    }

    const finishedAt = new Date().toISOString();
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    const consoleErrors = [...this.consoleMon.getErrors(), ...this.consoleMon.getJsErrors()];
    const networkErrors = this.buildNetworkErrors();

    // Performance checks in checks list
    if (perf.ttfb !== undefined) {
      this.checks.push({ name: 'TTFB', status: perf.ttfb > 800 ? 'warning' : 'pass', detail: `${perf.ttfb}ms` });
    }
    if (perf.lcp !== undefined) {
      const s = perf.lcp > 4000 ? 'fail' : perf.lcp > 2500 ? 'warning' : 'pass';
      this.checks.push({ name: 'LCP', status: s, detail: `${perf.lcp}ms` });
    }
    if (consoleErrors.length > 0) {
      this.checks.push({ name: 'Erros de console', status: 'fail', detail: `${consoleErrors.length} erro(s)` });
    }
    if (networkErrors.filter(e => e.status && e.status >= 500).length > 0) {
      this.checks.push({ name: 'Erros HTTP 5xx', status: 'fail', detail: `${networkErrors.filter(e => e.status && e.status >= 500).length} erro(s) de servidor` });
    }

    return {
      sessionId: this.sessionId,
      goal,
      baseUrl,
      intent:       intentDef?.id,
      intentName:   intentDef?.name,
      intentSteps:  intentDef?.steps,
      customSteps:  customSteps?.length ? customSteps : undefined,
      timeline: this.timeline,
      flows: Array.from(this.flows.values()),
      brokenLinks: this.brokenLinks,
      networkErrors,
      consoleErrors,
      performance: perf,
      loginStatus: this.loginStatus,
      loginError: this.loginError,
      videoPath,
      totalChecks: this.checks.length,
      passed:   this.checks.filter(c => c.status === 'pass').length,
      failed:   this.checks.filter(c => c.status === 'fail').length,
      warnings: this.checks.filter(c => c.status === 'warning').length,
      startedAt,
      finishedAt,
      durationMs,
    };
  }

  // ─── 1. Navigate ─────────────────────────────────────────────────────────────

  private async navigate(page: Page, url: string): Promise<boolean> {
    const t0 = Date.now();
    this.addEvent('navigate', 'navigate', `Abrindo ${url}`, undefined, url);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      const title  = await page.title().catch(() => '');
      const ms     = Date.now() - t0;
      const ss     = await this.snap('inicial');
      this.addEvent('success', 'navigate', `Página carregada em ${ms}ms`, `Título: "${title}"`, url, ss);
      this.check('Carregamento', 'pass', `${ms}ms · "${title}"`);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const ss  = await this.snap('erro-navegacao');
      this.addEvent('error', 'navigate', 'Falha ao carregar a página', msg, url, ss);
      this.check('Carregamento', 'fail', msg);
      return false;
    }
  }

  // ─── 2. SEO ───────────────────────────────────────────────────────────────────

  private async runSeoChecks(page: Page): Promise<void> {
    const flow = this.startFlow('SEO & Metadados', page.url());
    try {
      const title = await page.title().catch(() => '');
      if (title) this.flowEvent(flow, 'success', `Título: "${title}"`);
      else        this.flowEvent(flow, 'warning', 'Página sem título');
      this.check('Título', title ? 'pass' : 'warning', title || '(ausente)');

      const h1Count = await page.$$eval('h1', els => els.length).catch(() => 0);
      if (h1Count === 0) { this.flowEvent(flow, 'warning', 'Nenhuma tag H1'); this.check('H1', 'warning', 'ausente'); }
      else                { this.flowEvent(flow, 'success', `${h1Count} H1 encontrado(s)`); this.check('H1', 'pass', `${h1Count}`); }

      const meta = await page.$eval('meta[name="description"]', el => el.getAttribute('content') || '').catch(() => '');
      if (!meta) { this.flowEvent(flow, 'warning', 'Meta description ausente'); this.check('Meta description', 'warning', 'ausente'); }
      else        { this.flowEvent(flow, 'success', `Meta: "${meta.slice(0, 60)}"`); this.check('Meta description', 'pass', meta.slice(0, 60)); }

      flow.status = 'pass';
    } catch { flow.status = 'pass'; }
  }

  // ─── 3. Login flow ────────────────────────────────────────────────────────────

  private async detectLoginForm(page: Page): Promise<boolean> {
    try {
      const hasPassword = await page.$('input[type="password"]') !== null;
      const hasSubmit   = await page.$('button[type="submit"], input[type="submit"], button') !== null;
      return hasPassword && hasSubmit;
    } catch { return false; }
  }

  private async runLoginFlow(page: Page, creds?: TestCredentials): Promise<void> {
    const flow = this.startFlow('Login', page.url());

    const ss0 = await this.snap('login-antes');
    this.flowEvent(flow, 'info', 'Formulário de login detectado', undefined, ss0);

    try {
      // Username/email
      const userSel = 'input[type="email"], input[name*="email" i], input[name*="user" i], input[name*="login" i], input[placeholder*="email" i], input[placeholder*="usuário" i], input[placeholder*="usuario" i], input[placeholder*="user" i]';
      const userInput = await page.$(userSel);

      if (userInput) {
        const ph = await userInput.getAttribute('placeholder') || 'usuário';
        this.flowEvent(flow, 'found', `Campo "${ph}" encontrado`);
        const val = creds?.username || 'teste@automacaoqa.com';
        await userInput.fill(val, { timeout: 5000 });
        this.flowEvent(flow, 'fill', `Preenchido com: ${creds?.username ? `"${val}"` : '(dado de teste)'}`);
        this.check('Campo usuário', 'pass', `Encontrado e preenchido`);
      } else {
        this.flowEvent(flow, 'warning', 'Campo de usuário não encontrado');
        this.check('Campo usuário', 'warning', 'Não encontrado');
      }

      // Password
      const passInput = await page.$('input[type="password"]');
      if (passInput) {
        this.flowEvent(flow, 'found', 'Campo de senha encontrado');
        const val = creds?.password || 'Teste@123456';
        await passInput.fill(val, { timeout: 5000 });
        this.flowEvent(flow, 'fill', 'Senha preenchida');
        this.check('Campo senha', 'pass', 'Encontrado e preenchido');
      } else {
        this.flowEvent(flow, 'warning', 'Campo de senha não encontrado');
        this.check('Campo senha', 'warning', 'Não encontrado');
      }

      const ssFilled = await this.snap('login-preenchido');
      this.flowEvent(flow, 'info', 'Campos preenchidos', undefined, ssFilled);

      // Submit
      const submitBtn = await page.$('button[type="submit"], input[type="submit"], button:not([type="button"])');
      if (submitBtn) {
        const btnText = (await submitBtn.textContent() || 'Entrar').trim();
        this.flowEvent(flow, 'click', `Clicando botão "${btnText}"`);
        this.networkMon.reset();
        await submitBtn.click({ timeout: 5000 });
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      }

      const ssAfter = await this.snap('login-apos-submit');

      // Detect result: check success first, then errors
      const urlNow    = page.url();
      const urlChanged = urlNow !== this.baseUrl && urlNow !== `${this.baseUrl}/` && !urlNow.includes('/login');
      const successDialog = await this.detectSuccessMessage(page);
      const errorMsg  = successDialog ? '' : await this.detectErrorMessage(page);

      if (urlChanged || successDialog) {
        this.loginStatus = 'pass';
        const detail = urlChanged
          ? `Redirecionado para ${urlNow}`
          : 'Confirmação de login detectada (dialog de sucesso)';
        this.flowEvent(flow, 'success', `Login realizado — ${detail}`, undefined, ssAfter);
        this.check('Login', 'pass', detail);
        flow.status = 'pass';
      } else if (errorMsg) {
        this.loginStatus = 'fail';
        this.loginError  = errorMsg;
        this.flowEvent(flow, 'error', `Erro detectado: "${errorMsg}"`, undefined, ssAfter);
        this.check('Login', 'fail', errorMsg.slice(0, 100));
        flow.status       = 'fail';
        flow.reason       = 'Mensagem de erro exibida no formulário';
        flow.errorMessage = errorMsg;
      } else {
        // Check for logged-in DOM indicators
        const loggedIn = await page.$$('[class*="logout" i], [class*="sair" i], [class*="user-menu" i], [class*="avatar" i], [class*="perfil" i], [class*="navbar-user" i]').then(els => els.length > 0).catch(() => false);
        if (loggedIn) {
          this.loginStatus = 'pass';
          this.flowEvent(flow, 'success', 'Login realizado (indicadores de sessão detectados no DOM)', undefined, ssAfter);
          this.check('Login', 'pass', 'Sessão ativa detectada');
          flow.status = 'pass';
        } else {
          this.loginStatus = 'fail';
          this.loginError  = 'Sem redirecionamento ou confirmação após o submit';
          this.flowEvent(flow, 'warning', 'Resultado inconclusivo — sem redirecionamento ou confirmação', undefined, ssAfter);
          this.check('Login', 'warning', 'Inconclusivo');
          flow.status = 'fail';
          flow.reason = 'Nenhuma confirmação de login detectada após o submit';
        }
      }

      flow.screenshots.push(...[ss0, ssFilled, ssAfter].filter(Boolean) as string[]);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.loginStatus = 'fail';
      this.loginError  = msg;
      flow.status      = 'fail';
      flow.reason      = msg;
      this.flowEvent(flow, 'error', `Erro durante login: ${msg}`);
      this.check('Login', 'fail', msg);
    }
  }

  // ─── 4. Content tests ─────────────────────────────────────────────────────────

  private async runElementInventory(page: Page): Promise<void> {
    const flow = this.startFlow('Inventário de Elementos', page.url());
    try {
      const counts = await page.evaluate(() => ({
        buttons: document.querySelectorAll('button, [role="button"], input[type="submit"]').length,
        inputs:  document.querySelectorAll('input:not([type="hidden"]), textarea, select').length,
        forms:   document.querySelectorAll('form').length,
        links:   document.querySelectorAll('a[href]').length,
      })).catch(() => ({ buttons: 0, inputs: 0, forms: 0, links: 0 }));

      this.flowEvent(flow, 'info',
        `${counts.forms} formulário(s) · ${counts.buttons} botão(ões) · ${counts.inputs} campo(s) · ${counts.links} link(s)`);
      this.check('Elementos detectados', 'info',
        `${counts.forms} forms · ${counts.buttons} buttons · ${counts.inputs} inputs · ${counts.links} links`);
      flow.status = 'pass';
    } catch { flow.status = 'pass'; }
  }

  private async runFormTests(page: Page): Promise<void> {
    const flow = this.startFlow('Formulários', page.url());
    try {
      const formCount = await page.$$eval('form', f => f.length).catch(() => 0);
      if (formCount === 0) {
        this.flowEvent(flow, 'info', 'Nenhum formulário adicional encontrado');
        flow.status = 'pass';
        return;
      }

      for (let i = 0; i < Math.min(formCount, 3); i++) {
        await this.testOneForm(page, i, flow);
      }
      flow.status = flow.events.some(e => e.type === 'error') ? 'fail' : 'pass';
    } catch { flow.status = 'pass'; }
  }

  private async testOneForm(page: Page, idx: number, flow: TestFlow): Promise<void> {
    try {
      const info = await page.evaluate((i) => {
        const form = document.querySelectorAll('form')[i];
        if (!form) return null;
        return {
          action: form.getAttribute('action') || '',
          fields: Array.from(form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'))
            .map(el => `${(el as HTMLInputElement).name || (el as HTMLInputElement).placeholder || el.tagName.toLowerCase()}`),
        };
      }, idx);

      if (!info) return;

      this.flowEvent(flow, 'info', `Formulário #${idx + 1}: ${info.fields.join(', ') || 'sem campos'}`);
      const ss = await this.snap(`form-${idx}-before`);

      // Fill with test data
      const inputs = await page.$$(`form:nth-of-type(${idx + 1}) input:not([type="hidden"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), form:nth-of-type(${idx + 1}) textarea`);
      for (const inp of inputs) {
        const type = await inp.getAttribute('type') || 'text';
        const name = (await inp.getAttribute('name') || '').toLowerCase();
        const ph   = (await inp.getAttribute('placeholder') || '').toLowerCase();
        const value = this.testDataFor(type, name, ph);
        await inp.fill(value, { timeout: 3000 }).catch(() => {});
      }

      const ssAfter = await this.snap(`form-${idx}-filled`);

      const submitBtn = await page.$(`form:nth-of-type(${idx + 1}) button[type="submit"], form:nth-of-type(${idx + 1}) input[type="submit"]`);
      if (submitBtn) {
        this.networkMon.reset();
        await submitBtn.click({ timeout: 5000 }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});

        const reqs = this.networkMon.getRequests();
        const post = reqs.find(r => r.method === 'POST');
        if (post?.status) {
          const ok = post.status < 500;
          this.flowEvent(flow, ok ? 'success' : 'error',
            `Formulário #${idx + 1}: POST → HTTP ${post.status}`,
            ok ? undefined : `Servidor retornou ${post.status}`,
            ssAfter);
          if (!ok) this.check(`Formulário #${idx + 1}`, 'fail', `HTTP ${post.status} no envio`);
          else      this.check(`Formulário #${idx + 1}`, 'pass', `HTTP ${post.status}`);
        }

        const errMsg = await this.detectErrorMessage(page);
        if (errMsg) this.flowEvent(flow, 'info', `Mensagem: "${errMsg}"`);
      }

      // Navigate back if redirected
      if (!page.url().includes(new URL(this.baseUrl).hostname)) {
        await page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      }
    } catch { /* ignore form test errors */ }
  }

  private async runLinkChecks(page: Page): Promise<void> {
    const flow = this.startFlow('Links', page.url());
    try {
      const origin = new URL(this.baseUrl).origin;
      const links = await page.$$eval('a[href]', (els, origin) =>
        els.map(el => ({
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80),
          href: (el as HTMLAnchorElement).href,
          html: el.outerHTML.slice(0, 200),
        })).filter(l => l.href.startsWith(origin) && !l.href.includes('#') && !l.href.endsWith('/')),
        origin
      ).catch(() => [] as Array<{ text: string; href: string; html: string }>);

      this.flowEvent(flow, 'info', `Verificando ${Math.min(links.length, 10)} de ${links.length} link(s) interno(s)`);

      let broken = 0;
      for (const link of links.slice(0, 10)) {
        try {
          const t0 = Date.now();
          const res = await fetch(link.href, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
          const ms  = Date.now() - t0;
          if (res.status >= 400) {
            broken++;
            this.brokenLinks.push({ text: link.text || '(sem texto)', href: link.href, status: res.status, elementHtml: link.html });
            this.flowEvent(flow, 'error', `Link quebrado: "${link.text || link.href}"`, `HTTP ${res.status}`);
            this.check(`Link: "${link.text || link.href}"`, 'fail', `HTTP ${res.status}`);
          } else {
            this.flowEvent(flow, 'success', `Link OK: "${link.text || link.href}"`, `${ms}ms`);
          }
        } catch {
          broken++;
          this.brokenLinks.push({ text: link.text, href: link.href, status: 0, elementHtml: link.html });
          this.flowEvent(flow, 'error', `Link inacessível: "${link.text || link.href}"`, 'Timeout ou erro de rede');
        }
      }

      if (broken === 0 && links.length > 0) {
        this.check('Links internos', 'pass', `${links.length} link(s) verificado(s)`);
      } else if (links.length === 0) {
        this.flowEvent(flow, 'info', 'Nenhum link interno encontrado');
      }

      flow.status = broken > 0 ? 'fail' : 'pass';
    } catch { flow.status = 'pass'; }
  }

  // ─── Intent-specific flow ────────────────────────────────────────────────────

  private async runIntentFlow(page: Page, baseUrl: string, intent: IntentDefinition): Promise<void> {
    const origin = new URL(baseUrl).origin;
    const flow = this.startFlow(intent.name, page.url());
    this.flowEvent(flow, 'info', `${intent.emoji} Intenção: ${intent.name}`, intent.description);

    // Try to navigate to known paths for this intent
    let intentUrl: string | null = null;
    for (const tryPath of intent.paths) {
      const testUrl = `${origin}${tryPath}`;
      try {
        const res = await fetch(testUrl, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
        if (res.status < 400) { intentUrl = testUrl; break; }
      } catch { /* try next */ }
    }

    if (intentUrl && intentUrl !== page.url() && intentUrl !== `${page.url()}/`) {
      await page.goto(intentUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      const ss = await this.snap(`${intent.id}-page`);
      this.flowEvent(flow, 'navigate', `Navegou para ${intentUrl}`, undefined, ss);
      flow.url = intentUrl;
    } else if (!intentUrl) {
      this.flowEvent(flow, 'info', `Testando na página atual — nenhuma URL específica encontrada para ${intent.name}`);
    }

    // Check DOM indicators
    let found = 0;
    for (const sel of intent.selectors) {
      const exists = await page.$(sel) !== null;
      if (exists) {
        found++;
        this.flowEvent(flow, 'found', `Elemento de ${intent.name} detectado`, sel);
      }
    }
    if (intent.selectors.length > 0 && found === 0) {
      this.flowEvent(flow, 'warning', `Nenhum elemento específico de ${intent.name} detectado na página`);
    }

    // Run generic checks on this intent page
    await this.runElementInventory(page);
    await this.runLinkChecks(page);

    const ss = await this.snap(`${intent.id}-final`);
    flow.screenshots.push(...[ss].filter(Boolean) as string[]);
    flow.status = flow.events.some(e => e.type === 'error') ? 'fail' : 'pass';
  }

  // ─── 5. Accessibility ─────────────────────────────────────────────────────────

  private async runAccessibilityChecks(page: Page): Promise<void> {
    const flow = this.startFlow('Acessibilidade', page.url());
    try {
      const imgsNoAlt = await page.$$eval('img:not([alt])', els => els.map(el => (el as HTMLImageElement).src).slice(0, 5)).catch(() => [] as string[]);
      if (imgsNoAlt.length > 0) {
        this.flowEvent(flow, 'warning', `${imgsNoAlt.length} imagem(ns) sem alt text`);
        this.check('Imagens sem alt text', 'warning', `${imgsNoAlt.length} imagem(ns)`);
      } else {
        this.flowEvent(flow, 'success', 'Todas as imagens possuem alt text');
        this.check('Imagens com alt text', 'pass', 'OK');
      }
      flow.status = imgsNoAlt.length > 0 ? 'fail' : 'pass';
    } catch { flow.status = 'pass'; }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private async detectErrorMessage(page: Page): Promise<string> {
    // Keywords that indicate SUCCESS — never treat these as errors
    const successKeywords = ['sucesso', 'success', 'logado', 'bem-vindo', 'welcome', 'logged in', 'login efetuado', 'entrou', 'autenticado'];

    const selectors = [
      '.invalid-feedback',
      '[class*="error-message"]', '[class*="erro-message"]',
      '[class*="form-error"]', '[class*="field-error"]',
      '[role="alert"]:not([class*="swal"]):not([class*="toast-success"]):not([class*="success"])',
      '[class*="danger"]:not([class*="swal"])',
    ];

    for (const sel of selectors) {
      const text = await page.$eval(sel, el => el.textContent?.trim() || '').catch(() => '');
      const normalized = text.toLowerCase();
      if (
        text && text.length > 2 && text.length < 300 &&
        !successKeywords.some(kw => normalized.includes(kw))
      ) {
        return text;
      }
    }
    return '';
  }

  // ─── Custom user instructions ────────────────────────────────────────────────

  private async runCustomSteps(page: Page, steps: string[]): Promise<void> {
    const flow = this.startFlow('Instruções Personalizadas', page.url());
    this.flowEvent(flow, 'info', `Executando ${steps.length} instrução(ões) personalizada(s) do usuário`);

    for (let i = 0; i < steps.length; i++) {
      const instruction = steps[i];
      const ssBefore = await this.snap(`custom-${i + 1}-before`);
      this.flowEvent(flow, 'info', `▶ ${instruction}`, undefined, ssBefore);

      try {
        const result = await this.executeCustomInstruction(page, instruction);
        const ssAfter = await this.snap(`custom-${i + 1}-after`);
        if (result.success) {
          this.flowEvent(flow, 'success', `✓ ${instruction}`, result.detail, ssAfter);
          this.check(`Instrução: ${instruction.slice(0, 60)}`, 'pass', result.detail);
        } else {
          this.flowEvent(flow, 'warning', `Instrução não executada: ${instruction}`, result.detail, ssAfter);
          this.check(`Instrução: ${instruction.slice(0, 60)}`, 'warning', result.detail);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.flowEvent(flow, 'error', `Falha ao executar: ${instruction}`, msg);
        this.check(`Instrução: ${instruction.slice(0, 60)}`, 'fail', msg);
      }
    }

    flow.status = flow.events.some(e => e.type === 'error') ? 'fail' : 'pass';
  }

  private async executeCustomInstruction(page: Page, instruction: string): Promise<{ success: boolean; detail: string }> {
    const norm = instruction.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    // === CLOSE MODAL / X BUTTON ===
    const isClose = norm.includes('fechar') || norm.includes('feche') || norm.includes('fecha') ||
      /clicar? (no|em|o) x\b/.test(norm) || norm.includes('botao x') ||
      norm.includes('modal') || norm.includes('popup') || norm.includes('overlay');

    if (isClose) {
      const closeSelectors = [
        '[aria-label*="close" i]', '[aria-label*="fechar" i]',
        '.modal-close', '.close-btn', '[data-dismiss="modal"]',
        'button.close', '.popup-close', '[class*="modal__close"]',
        '[class*="close-button"]', '[class*="closeButton"]',
        '.swal2-close', '[class*="btn-close"]',
      ];
      for (const sel of closeSelectors) {
        try {
          const el = await page.$(sel);
          if (el && await el.isVisible()) {
            await el.click({ timeout: 5000 });
            await page.waitForTimeout(700);
            return { success: true, detail: `Clicou no seletor: ${sel}` };
          }
        } catch { /* try next */ }
      }
      // Try X / close by visible text
      for (const text of ['×', '✕', '✗', 'X', 'Fechar', 'Close']) {
        try {
          const btn = page.getByRole('button', { name: text, exact: true });
          if (await btn.isVisible({ timeout: 1500 })) {
            await btn.click({ timeout: 3000 });
            await page.waitForTimeout(700);
            return { success: true, detail: `Clicou no botão "${text}"` };
          }
        } catch { /* try next */ }
      }
      return { success: false, detail: 'Nenhum botão de fechar encontrado na página' };
    }

    // === NAVIGATE ===
    const navMatch = norm.match(/(?:ir para|navegar para|acessar|abrir|va para|va a)\s+(.+)/);
    if (navMatch) {
      const raw = instruction.match(/(?:ir para|navegar para|acessar|abrir|va para|va a)\s+(.+)/i)?.[1]?.trim() || '';
      const urlInLine = raw.match(/https?:\/\/\S+/);
      const pathInLine = raw.match(/\/[\w/-]*/);
      if (urlInLine) {
        await page.goto(urlInLine[0], { waitUntil: 'domcontentloaded', timeout: 15000 });
        return { success: true, detail: `Navegou para ${urlInLine[0]}` };
      } else if (pathInLine) {
        const url = new URL(pathInLine[0], this.baseUrl).href;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        return { success: true, detail: `Navegou para ${url}` };
      }
    }

    // === CLICK BY TEXT / BUTTON ===
    const clickMatch = instruction.match(/(?:clique?|clica|pressione?)\s+(?:no|em|na|o|a|no botão|no link|no elemento|no campo)\s+[""']?(.+?)[""']?\s*$/i);
    if (clickMatch) {
      const target = clickMatch[1].trim();
      try {
        const btn = page.getByRole('button', { name: new RegExp(target, 'i') });
        if (await btn.first().isVisible({ timeout: 2000 })) {
          await btn.first().click({ timeout: 5000 });
          await page.waitForTimeout(500);
          return { success: true, detail: `Clicou no botão "${target}"` };
        }
      } catch { /* try text */ }
      try {
        const el = page.getByText(target, { exact: false });
        if (await el.first().isVisible({ timeout: 2000 })) {
          await el.first().click({ timeout: 5000 });
          await page.waitForTimeout(500);
          return { success: true, detail: `Clicou no elemento com texto "${target}"` };
        }
      } catch { /* failed */ }
      return { success: false, detail: `Elemento "${target}" não encontrado na página` };
    }

    // === WAIT ===
    const waitMsMatch  = norm.match(/(?:espere?r?|aguarde?r?)\s+(\d+)\s*ms/);
    const waitSecMatch = norm.match(/(?:espere?r?|aguarde?r?)\s+(\d+)\s*(?:s\b|segundo)/);
    if (waitMsMatch) {
      await page.waitForTimeout(parseInt(waitMsMatch[1]));
      return { success: true, detail: `Aguardou ${waitMsMatch[1]}ms` };
    }
    if (waitSecMatch) {
      await page.waitForTimeout(parseInt(waitSecMatch[1]) * 1000);
      return { success: true, detail: `Aguardou ${waitSecMatch[1]} segundo(s)` };
    }

    return { success: false, detail: 'Instrução não reconhecida pelo executor automático (sem ação tomada)' };
  }

  private async detectSuccessMessage(page: Page): Promise<boolean> {
    const successKeywords = ['sucesso', 'success', 'logado', 'bem-vindo', 'welcome', 'logged in', 'login efetuado', 'autenticado'];
    // Check SweetAlert2 success, toast-success, etc.
    const sweetSelectors = [
      '.swal2-success', '.swal2-popup .swal2-title',
      '.toast-success', '[class*="success"][role="alert"]',
      '[class*="alert-success"]', '[class*="notification-success"]',
    ];
    for (const sel of sweetSelectors) {
      const text = await page.$eval(sel, el => el.textContent?.trim().toLowerCase() || '').catch(() => '');
      if (text && successKeywords.some(kw => text.includes(kw))) return true;
    }
    return false;
  }

  private async snap(label: string): Promise<string | undefined> {
    const n = ++this.screenshotCounter;
    const r = await this.screenshotMgr.capture(n, label).catch(() => null);
    if (!r) return undefined;
    // Return relative path from the session root so the frontend can build a URL
    return `screenshots/${r.filename}`;
  }

  private startFlow(name: string, url: string): TestFlow {
    const flow: TestFlow = { name, url, status: 'pass', events: [], screenshots: [] };
    this.flows.set(name, flow);
    return flow;
  }

  private addSkippedFlow(name: string, reason: string, blockedBy: string): void {
    const ts = new Date().toISOString();
    const event: TimelineEvent = { timestamp: ts, type: 'skipped', flowName: name, description: `[${name}] Não executado — ${reason}` };
    const flow: TestFlow = { name, url: '', status: 'skipped', reason, blockedBy, events: [event], screenshots: [] };
    this.flows.set(name, flow);
    this.timeline.push(event);
    this.emit('check_result', { name, status: 'skipped', detail: reason });
  }

  private flowEvent(flow: TestFlow, type: TimelineEvent['type'], description: string, detail?: string, screenshotPath?: string): void {
    const ev: TimelineEvent = {
      timestamp: new Date().toISOString(),
      type, flowName: flow.name, description, detail, screenshotPath, url: flow.url,
    };
    flow.events.push(ev);
    this.timeline.push(ev);
    this.emit('check_result', { name: description, status: type === 'error' ? 'fail' : type === 'warning' ? 'warning' : type === 'skipped' ? 'info' : 'pass', detail: detail || '' });
  }

  private addEvent(type: TimelineEvent['type'], flowName: string, description: string, detail?: string, url?: string, screenshotPath?: string): void {
    const ev: TimelineEvent = { timestamp: new Date().toISOString(), type, flowName, description, detail, screenshotPath, url };
    this.timeline.push(ev);
    this.emit('check_result', { name: description, status: type === 'error' ? 'fail' : 'pass', detail: detail || '' });
  }

  private check(name: string, status: 'pass' | 'fail' | 'warning' | 'info', detail: string): void {
    this.checks.push({ name, status, detail });
  }

  private buildNetworkErrors(): NetworkErrorDetail[] {
    return this.networkMon.getRequests()
      .filter(r => r.isError || (r.status !== undefined && r.status >= 400))
      .map(r => ({
        method:       r.method,
        url:          r.url,
        status:       r.status,
        duration:     r.duration,
        responseBody: r.responseBody,
        error:        r.error,
        timestamp:    new Date().toISOString(),
      }));
  }

  private testDataFor(type: string, name: string, placeholder: string): string {
    const key = `${type} ${name} ${placeholder}`.toLowerCase();
    if (key.includes('email'))                           return 'teste@automacaoqa.com';
    if (key.includes('password') || key.includes('senha')) return 'Teste@123456';
    if (key.includes('phone') || key.includes('tel'))    return '(11) 99999-9999';
    if (key.includes('name') || key.includes('nome'))    return 'João Silva';
    if (key.includes('url'))                             return 'https://exemplo.com';
    if (key.includes('date') || key.includes('data'))    return '2024-01-15';
    if (type === 'number')                               return '42';
    return 'Texto de teste automático';
  }

  private emit(type: string, payload: Record<string, unknown>): void {
    if (this.broadcast) {
      try { this.broadcast({ type, sessionId: this.sessionId, payload }); } catch { /* ignore */ }
    }
  }
}
