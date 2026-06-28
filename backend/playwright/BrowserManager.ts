/**
 * BrowserManager — lifecycle management for Playwright browser instances.
 *
 * Responsibilities:
 * - Launch/close browser
 * - Create contexts with optional video recording
 * - Provide the page to other modules
 * - Never expose Playwright internals outside this module
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import type { AgentConfig } from '../agent/types';

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  videoPath?: string;
}

export class BrowserManager {
  private session: BrowserSession | null = null;

  async launch(config: AgentConfig, sessionWorkspace: string): Promise<BrowserSession> {
    const browser = await chromium.launch({
      headless: config.headless ?? true,
      slowMo: config.slowMo ?? 0,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const contextOptions: Parameters<Browser['newContext']>[0] = {
      viewport: config.viewport ?? { width: 1366, height: 768 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
    };

    if (config.videoEnabled !== false) {
      contextOptions.recordVideo = {
        dir: path.join(sessionWorkspace, 'video'),
        size: { width: 1366, height: 768 },
      };
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // Set default timeouts
    page.setDefaultTimeout(config.timeout ?? 30000);
    page.setDefaultNavigationTimeout(config.timeout ?? 30000);

    this.session = { browser, context, page };
    return this.session;
  }

  async close(): Promise<string | undefined> {
    if (!this.session) return undefined;

    let videoPath: string | undefined;

    try {
      const video = this.session.page.video();
      if (video) {
        await this.session.context.close(); // Must close context before getting video path
        const vp = await video.path().catch(() => null);
        if (vp) videoPath = vp;
      } else {
        await this.session.context.close();
      }
    } catch { /* ignore */ }

    try {
      await this.session.browser.close();
    } catch { /* ignore */ }

    this.session = null;
    return videoPath;
  }

  getPage(): Page {
    if (!this.session) throw new Error('Browser not launched');
    return this.session.page;
  }

  getContext(): BrowserContext {
    if (!this.session) throw new Error('Browser not launched');
    return this.session.context;
  }

  isActive(): boolean {
    return this.session !== null;
  }
}
