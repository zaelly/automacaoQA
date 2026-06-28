/**
 * NetworkMonitor — intercepts and records all HTTP requests/responses.
 * Attaches to the Playwright page and collects data for the agent's context.
 */

import type { Page, Request, Response } from 'playwright';
import type { NetworkRequest } from '../agent/types';

export class NetworkMonitor {
  private requests: NetworkRequest[] = [];
  private errors: string[] = [];
  private pendingRequests = new Map<string, { url: string; method: string; startTime: number; headers: Record<string, string> }>();

  constructor(private page: Page) {}

  attach(): void {
    this.page.on('request', this.onRequest.bind(this));
    this.page.on('response', this.onResponse.bind(this));
    this.page.on('requestfailed', this.onRequestFailed.bind(this));
  }

  detach(): void {
    this.page.removeListener('request', this.onRequest.bind(this));
    this.page.removeListener('response', this.onResponse.bind(this));
    this.page.removeListener('requestfailed', this.onRequestFailed.bind(this));
  }

  private onRequest(request: Request): void {
    const url = request.url();
    if (this.shouldIgnore(url)) return;

    this.pendingRequests.set(request.url(), {
      url,
      method: request.method(),
      startTime: Date.now(),
      headers: request.headers() as Record<string, string>,
    });
  }

  private async onResponse(response: Response): Promise<void> {
    const url = response.url();
    if (this.shouldIgnore(url)) return;

    const pending = this.pendingRequests.get(url);
    const duration = pending ? Date.now() - pending.startTime : undefined;
    this.pendingRequests.delete(url);

    const status = response.status();
    const isError = status >= 400;

    let responseBody: string | undefined;
    if (isError) {
      try {
        const body = await response.text();
        responseBody = body.slice(0, 500);
      } catch { /* ignore */ }
    }

    const record: NetworkRequest = {
      url,
      method: pending?.method || response.request().method(),
      status,
      duration,
      requestHeaders: pending?.headers,
      responseHeaders: response.headers() as Record<string, string>,
      responseBody: isError ? responseBody : undefined,
      isError,
    };

    this.requests.push(record);

    if (isError) {
      this.errors.push(`${status} ${record.method} ${url}${responseBody ? ` — ${responseBody.slice(0, 100)}` : ''}`);
    }
  }

  private onRequestFailed(request: Request): void {
    const url = request.url();
    if (this.shouldIgnore(url)) return;

    const failure = request.failure();
    const errorMsg = `FAILED ${request.method()} ${url}: ${failure?.errorText || 'unknown error'}`;

    this.requests.push({
      url,
      method: request.method(),
      isError: true,
      error: failure?.errorText,
    });

    this.errors.push(errorMsg);
    this.pendingRequests.delete(url);
  }

  private shouldIgnore(url: string): boolean {
    // Skip analytics, tracking pixels, and browser-internal requests
    return url.startsWith('data:') ||
      url.includes('google-analytics') ||
      url.includes('googletagmanager') ||
      url.includes('hotjar') ||
      url.includes('facebook.com/tr') ||
      url.includes('clarity.ms');
  }

  getRequests(): NetworkRequest[] {
    return [...this.requests];
  }

  getErrors(): string[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
  }

  reset(): void {
    this.requests = [];
    this.errors = [];
    this.pendingRequests.clear();
  }
}
