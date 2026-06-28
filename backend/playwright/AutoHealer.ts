/**
 * AutoHealer — finds elements using multiple fallback strategies.
 *
 * When an element can't be found with a direct approach, we cascade through:
 * 1. getByRole with name
 * 2. getByLabel
 * 3. getByPlaceholder
 * 4. getByText (exact, then partial)
 * 5. getByAltText
 * 6. aria-label attribute
 * 7. CSS selector (if target looks like one)
 * 8. Ask Gemini for an alternative selector
 *
 * This makes the agent resilient to minor UI changes and element restructuring.
 */

import type { Page, Locator } from 'playwright';
import type { HealingResult } from '../agent/types';

export interface HealerOptions {
  nth?: number;
  timeout?: number;
  healWithGemini?: (target: string, html: string, screenshot?: string) => Promise<{ selector: string; selectorType: string } | null>;
}

export class AutoHealer {
  constructor(private page: Page) {}

  /**
   * Find a locator for the given natural-language target using all strategies.
   * Returns the first one that finds a visible element.
   */
  async findElement(target: string, options: HealerOptions = {}): Promise<{
    locator: Locator;
    result: HealingResult;
  } | null> {
    const nth = options.nth ?? 0;
    const strategies = this.buildStrategies(target, nth);

    for (const { strategy, locator } of strategies) {
      try {
        const count = await locator.count();
        if (count === 0) continue;

        // Check if visible (with short timeout)
        const target_locator = count > 1 ? locator.nth(nth) : locator;
        const isVisible = await target_locator.isVisible({ timeout: 2000 }).catch(() => false);

        if (isVisible) {
          return {
            locator: target_locator,
            result: { found: true, strategy, confidence: 1.0 },
          };
        }

        // If not visible, try scrolling to it
        try {
          await target_locator.scrollIntoViewIfNeeded({ timeout: 2000 });
          const visibleAfterScroll = await target_locator.isVisible({ timeout: 1000 }).catch(() => false);
          if (visibleAfterScroll) {
            return {
              locator: target_locator,
              result: { found: true, strategy: `${strategy}+scroll`, confidence: 0.9 },
            };
          }
        } catch { /* continue */ }
      } catch { /* strategy failed, try next */ }
    }

    // Last resort: ask Gemini for a selector
    if (options.healWithGemini) {
      try {
        const html = await this.page.content().catch(() => '');
        const screenshot = await this.page.screenshot({ type: 'png' })
          .then(b => b.toString('base64'))
          .catch(() => undefined);

        const geminiResult = await options.healWithGemini(target, html, screenshot);
        if (geminiResult?.selector) {
          const fallbackLocator = geminiResult.selectorType === 'xpath'
            ? this.page.locator(`xpath=${geminiResult.selector}`)
            : this.page.locator(geminiResult.selector);

          const count = await fallbackLocator.count().catch(() => 0);
          if (count > 0) {
            return {
              locator: fallbackLocator,
              result: { found: true, strategy: 'gemini', fallbackSelector: geminiResult.selector, confidence: 0.6 },
            };
          }
        }
      } catch { /* ignore */ }
    }

    return null;
  }

  private buildStrategies(target: string, nth: number): Array<{ strategy: string; locator: Locator }> {
    const t = target.trim();
    const strategies: Array<{ strategy: string; locator: Locator }> = [];

    // 1. Role-based (most reliable for accessibility)
    const roleMap: Record<string, string[]> = {
      button: ['button', 'submit', 'Enviar', 'OK', 'Salvar', 'Entrar', 'Login'],
      link: ['link'],
      textbox: ['textbox', 'input', 'campo', 'field'],
      checkbox: ['checkbox'],
      radio: ['radio'],
      combobox: ['combobox', 'select', 'dropdown'],
    };

    for (const [role, keywords] of Object.entries(roleMap)) {
      if (keywords.some(k => t.toLowerCase().includes(k.toLowerCase()))) {
        strategies.push({
          strategy: `role:${role}`,
          locator: this.page.getByRole(role as any, { name: t, exact: false }),
        });
      }
    }

    // Always try generic role matching
    strategies.push({
      strategy: 'role:any',
      locator: this.page.getByRole('button', { name: t, exact: false }),
    });
    strategies.push({
      strategy: 'role:link',
      locator: this.page.getByRole('link', { name: t, exact: false }),
    });
    strategies.push({
      strategy: 'role:textbox',
      locator: this.page.getByRole('textbox', { name: t, exact: false }),
    });

    // 2. Label
    strategies.push({ strategy: 'label', locator: this.page.getByLabel(t, { exact: false }) });

    // 3. Placeholder
    strategies.push({ strategy: 'placeholder', locator: this.page.getByPlaceholder(t, { exact: false }) });

    // 4. Text (exact, then partial)
    strategies.push({ strategy: 'text:exact', locator: this.page.getByText(t, { exact: true }) });
    strategies.push({ strategy: 'text:partial', locator: this.page.getByText(t, { exact: false }) });

    // 5. Alt text (for images)
    strategies.push({ strategy: 'alt', locator: this.page.getByAltText(t, { exact: false }) });

    // 6. Title
    strategies.push({ strategy: 'title', locator: this.page.getByTitle(t, { exact: false }) });

    // 7. aria-label attribute
    strategies.push({
      strategy: 'aria-label',
      locator: this.page.locator(`[aria-label*="${t}" i]`),
    });

    // 8. name attribute
    strategies.push({
      strategy: 'name-attr',
      locator: this.page.locator(`[name*="${t}" i]`),
    });

    // 9. If target looks like a CSS selector, try it directly
    if (t.startsWith('#') || t.startsWith('.') || t.startsWith('[') || t.includes('>')) {
      strategies.push({ strategy: 'css', locator: this.page.locator(t) });
    }

    // 10. Partial text inside interactive elements
    strategies.push({
      strategy: 'interactive-text',
      locator: this.page.locator(`button, a, [role="button"]`).filter({ hasText: t }),
    });

    return strategies;
  }
}
