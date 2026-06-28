/**
 * PageAnalyzer — extracts structured context from the current page.
 *
 * The context is sent to Gemini so it can reason about the page state.
 * We simplify the HTML to remove noise (scripts, styles, SVGs) and
 * build an accessibility tree of interactive elements.
 */

import type { Page } from 'playwright';
import type { PageContext, PerformanceMetrics } from '../agent/types';

export class PageAnalyzer {
  constructor(private page: Page) {}

  async getContext(includeScreenshot = true): Promise<PageContext> {
    const [url, title, simplifiedHtml, accessibilityTree, screenshotBase64] =
      await Promise.all([
        this.getUrl(),
        this.getTitle(),
        this.getSimplifiedHtml(),
        this.getAccessibilityTree(),
        includeScreenshot ? this.getScreenshotBase64() : Promise.resolve(undefined),
      ]);

    return {
      url,
      title,
      simplifiedHtml,
      accessibilityTree,
      screenshotBase64,
      consoleErrors: [],   // Populated by ConsoleMonitor
      networkErrors: [],   // Populated by NetworkMonitor
      jsErrors: [],        // Populated by ConsoleMonitor
      viewportSize: { width: 1366, height: 768 },
    };
  }

  private async getUrl(): Promise<string> {
    return this.page.url();
  }

  private async getTitle(): Promise<string> {
    return this.page.title().catch(() => '');
  }

  /**
   * Returns stripped HTML — removes scripts/styles/SVGs, limits to 8000 chars.
   * Keeps: id, class, type, href, src, name, placeholder, role, aria-*, value, data-testid
   */
  async getSimplifiedHtml(): Promise<string> {
    try {
      const html = await this.page.evaluate(() => {
        const clone = document.body.cloneNode(true) as HTMLElement;

        // Remove noisy elements
        const noisy = clone.querySelectorAll('script, style, svg, noscript, link, meta, iframe');
        noisy.forEach(el => el.remove());

        // Strip all attributes except allowed ones
        const allowed = new Set(['id', 'class', 'type', 'href', 'src', 'name', 'placeholder',
          'role', 'value', 'checked', 'selected', 'disabled', 'data-testid', 'aria-label',
          'aria-labelledby', 'aria-describedby', 'aria-hidden', 'aria-expanded',
          'aria-selected', 'action', 'method', 'for', 'tabindex']);

        clone.querySelectorAll('*').forEach(el => {
          Array.from(el.attributes).forEach(attr => {
            if (!allowed.has(attr.name)) el.removeAttribute(attr.name);
          });
        });

        return clone.innerHTML;
      });

      // Collapse whitespace
      const compressed = html
        .replace(/\n\s*\n/g, '\n')
        .replace(/  +/g, ' ')
        .trim();

      return compressed.length > 8000
        ? compressed.slice(0, 8000) + '\n<!-- [HTML truncated for context window] -->'
        : compressed;
    } catch {
      return '';
    }
  }

  /**
   * Builds a human-readable accessibility tree of interactive elements.
   * This is more useful to the LLM than raw HTML because it focuses on
   * what can actually be interacted with.
   */
  async getAccessibilityTree(): Promise<string> {
    try {
      const elements = await this.page.evaluate(() => {
        const selectors = [
          'button:not([disabled]):not([hidden])',
          'a[href]',
          'input:not([type="hidden"]):not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[role="button"]:not([aria-disabled="true"])',
          '[role="link"]',
          '[role="checkbox"]',
          '[role="radio"]',
          '[role="menuitem"]',
          '[role="tab"]',
          '[tabindex="0"]:not(div):not(span)',
          'h1, h2, h3',
        ];

        const seen = new Set<Element>();
        const results: Array<{
          tag: string; role: string; text: string; label: string;
          placeholder: string; type: string; id: string; name: string;
          href: string; visible: boolean; position: string;
        }> = [];

        selectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            if (seen.has(el)) return;
            seen.add(el);

            const rect = el.getBoundingClientRect();
            const visible = rect.width > 0 && rect.height > 0;

            const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
            const label = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '';
            const id = el.id || '';
            const name = (el as HTMLInputElement).name || '';
            const placeholder = (el as HTMLInputElement).placeholder || '';
            const type = (el as HTMLInputElement).type || '';
            const href = (el as HTMLAnchorElement).href || '';
            const role = el.getAttribute('role') || el.tagName.toLowerCase();
            const position = visible ? `(${Math.round(rect.x)},${Math.round(rect.y)})` : '(hidden)';

            results.push({ tag: el.tagName.toLowerCase(), role, text, label, placeholder, type, id, name, href, visible, position });
          });
        });

        return results;
      });

      const lines = elements
        .slice(0, 80) // Limit to keep context manageable
        .map(el => {
          const parts = [`[${el.role}]`];
          if (el.label) parts.push(`label="${el.label}"`);
          if (el.text && el.text !== el.label) parts.push(`text="${el.text.slice(0, 50)}"`);
          if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
          if (el.type) parts.push(`type="${el.type}"`);
          if (el.id) parts.push(`id="${el.id}"`);
          if (el.name) parts.push(`name="${el.name}"`);
          if (el.href && !el.href.startsWith('javascript')) parts.push(`href="${el.href.slice(0, 60)}"`);
          if (!el.visible) parts.push('(not visible)');
          return parts.join(' ') + ` ${el.position}`;
        });

      return lines.join('\n') || 'No interactive elements found.';
    } catch {
      return 'Could not analyze page elements.';
    }
  }

  async getScreenshotBase64(): Promise<string | undefined> {
    try {
      const buffer = await this.page.screenshot({ type: 'png', fullPage: false });
      return buffer.toString('base64');
    } catch {
      return undefined;
    }
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const metrics = await this.page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');
        const fcp = paint.find(p => p.name === 'first-contentful-paint');

        return {
          ttfb:           nav ? nav.responseStart - nav.requestStart : undefined,
          domInteractive: nav ? nav.domInteractive - nav.fetchStart : undefined,
          domComplete:    nav ? nav.domComplete    - nav.fetchStart : undefined,
          loadEvent:      nav ? nav.loadEventEnd   - nav.fetchStart : undefined,
          fcp:            fcp  ? fcp.startTime : undefined,
          transferSize:   nav  ? nav.transferSize  : undefined,
          resourceCount:  performance.getEntriesByType('resource').length,
        };
      });

      return metrics;
    } catch {
      return {};
    }
  }
}
