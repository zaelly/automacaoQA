/**
 * SmartLocator — multi-strategy element finder.
 *
 * Never searches for a single hard-coded selector.
 * Tries every strategy in order until one returns a visible element.
 * Logs every attempt so the developer knows exactly what happened.
 */

import type { Page, Locator } from 'playwright';

export interface LocatorStrategy {
  description: string;
  type: 'css' | 'text' | 'regex' | 'role' | 'href' | 'xpath' | 'testid' | 'arialabel' | 'title';
  value: string;
  options?: Record<string, unknown>;
}

export interface FindResult {
  found: boolean;
  locator?: Locator;
  strategy?: LocatorStrategy;
  attemptIndex?: number;
  log: string[];
}

export class SmartLocator {

  async find(page: Page, strategies: LocatorStrategy[], timeout = 2000): Promise<FindResult> {
    const log: string[] = [];

    for (let i = 0; i < strategies.length; i++) {
      const s = strategies[i];
      log.push(`  [${i + 1}/${strategies.length}] ${s.description}`);
      try {
        const loc = this.build(page, s);
        const visible = await loc.first().isVisible({ timeout });
        if (visible) {
          log.push(`  ✔ Encontrado: ${s.description}`);
          return { found: true, locator: loc.first(), strategy: s, attemptIndex: i, log };
        }
        log.push(`  ✖ Não visível`);
      } catch {
        log.push(`  ✖ Timeout / não existe`);
      }
    }

    log.push(`  ✖ Todas as ${strategies.length} estratégias falharam`);
    return { found: false, log };
  }

  // Short-circuit version: stops at first visible match (faster)
  async findAny(page: Page, strategies: LocatorStrategy[], timeout = 1500): Promise<FindResult> {
    return this.find(page, strategies, timeout);
  }

  private build(page: Page, s: LocatorStrategy): Locator {
    switch (s.type) {
      case 'css':       return page.locator(s.value);
      case 'text':      return page.getByText(s.value, { exact: false });
      case 'regex':     return page.getByText(new RegExp(s.value, 'i'));
      case 'role':      return page.getByRole(s.value as Parameters<Page['getByRole']>[0], s.options as any);
      case 'href':      return page.locator(`a[href*="${s.value}"]`);
      case 'xpath':     return page.locator(`xpath=${s.value}`);
      case 'testid':    return page.locator(`[data-testid*="${s.value}" i],[data-cy*="${s.value}" i]`);
      case 'arialabel': return page.getByLabel(s.value, { exact: false });
      case 'title':     return page.locator(`[title*="${s.value}" i]`);
      default:          return page.locator(s.value);
    }
  }
}
