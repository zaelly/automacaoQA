/**
 * ConsoleMonitor — captures browser console messages and JavaScript errors.
 * Errors and warnings are surfaced to the agent as part of page context.
 */

import type { Page, ConsoleMessage as PlaywrightConsole } from 'playwright';
import type { ConsoleMessage } from '../agent/types';

export class ConsoleMonitor {
  private messages: ConsoleMessage[] = [];
  private jsErrors: string[] = [];
  private consoleErrors: string[] = [];

  constructor(private page: Page) {}

  attach(): void {
    this.page.on('console', this.onConsole.bind(this));
    this.page.on('pageerror', this.onPageError.bind(this));
  }

  detach(): void {
    this.page.removeListener('console', this.onConsole.bind(this));
    this.page.removeListener('pageerror', this.onPageError.bind(this));
  }

  private onConsole(msg: PlaywrightConsole): void {
    const type = msg.type() as ConsoleMessage['type'];
    const text = msg.text();

    // Skip noisy framework messages
    if (text.includes('Download the React DevTools') ||
        text.includes('[HMR]') ||
        text.includes('[vite]')) return;

    const record: ConsoleMessage = {
      type,
      text: text.slice(0, 500),
      location: msg.location()?.url,
      timestamp: new Date().toISOString(),
    };

    this.messages.push(record);

    if (type === 'error') {
      this.consoleErrors.push(text.slice(0, 200));
    } else if (type === 'warn') {
      if (text.toLowerCase().includes('error') || text.toLowerCase().includes('fail')) {
        this.consoleErrors.push(`[WARN] ${text.slice(0, 200)}`);
      }
    }
  }

  private onPageError(error: Error): void {
    const msg = `${error.name}: ${error.message}`;
    this.jsErrors.push(msg.slice(0, 300));
    this.messages.push({
      type: 'error',
      text: msg,
      timestamp: new Date().toISOString(),
    });
  }

  getMessages(): ConsoleMessage[] {
    return [...this.messages];
  }

  getErrors(): string[] {
    return [...this.consoleErrors];
  }

  getJsErrors(): string[] {
    return [...this.jsErrors];
  }

  clearErrors(): void {
    this.consoleErrors = [];
    this.jsErrors = [];
  }

  reset(): void {
    this.messages = [];
    this.consoleErrors = [];
    this.jsErrors = [];
  }
}
