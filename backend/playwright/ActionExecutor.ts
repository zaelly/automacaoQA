/**
 * ActionExecutor — converts AgentAction JSON decisions into Playwright commands.
 *
 * The AI NEVER runs Playwright code directly. It emits structured JSON, and
 * this class is the ONLY place that calls Playwright APIs.
 *
 * Each method handles one action type and returns a result indicating
 * success/failure and any useful metadata (text found, screenshot path, etc.)
 */

import * as path from 'path';
import * as fs from 'fs';
import type { Page } from 'playwright';
import type { AgentAction, ActionResult } from '../agent/types';
import { AutoHealer, type HealerOptions } from './AutoHealer';

export class ActionExecutor {
  private healer: AutoHealer;

  constructor(
    private page: Page,
    private sessionWorkspace: string,
    private geminiHeal?: (target: string, html: string, screenshot?: string) => Promise<{ selector: string; selectorType: string } | null>,
  ) {
    this.healer = new AutoHealer(page);
  }

  /** Execute any action decision from the agent. */
  async execute(action: AgentAction, stepNumber: number): Promise<ActionResult> {
    const startedAt = new Date().toISOString();

    try {
      const result = await this.dispatch(action, stepNumber);
      return { ...result, startedAt, finishedAt: new Date().toISOString() };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || String(err),
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    }
  }

  private async dispatch(action: AgentAction, stepNumber: number): Promise<ActionResult> {
    switch (action.type) {
      case 'goto':          return this.goto(action);
      case 'click':         return this.click(action);
      case 'doubleClick':   return this.doubleClick(action);
      case 'hover':         return this.hover(action);
      case 'fill':          return this.fill(action);
      case 'type':          return this.typeText(action);
      case 'press':         return this.press(action);
      case 'scroll':        return this.scroll(action);
      case 'select':        return this.select(action);
      case 'check':         return this.check(action, true);
      case 'uncheck':       return this.check(action, false);
      case 'wait':          return this.wait(action);
      case 'upload':        return this.upload(action);
      case 'download':      return this.download(action);
      case 'drag':          return this.drag(action);
      case 'assertText':    return this.assertText(action);
      case 'assertVisible': return this.assertVisible(action);
      case 'assertUrl':     return this.assertUrl(action);
      case 'assertRequest': return this.assertRequest(action);
      case 'assertResponse': return this.assertResponse(action);
      case 'takeScreenshot': return this.takeScreenshot(stepNumber);
      case 'takeSnapshot':  return this.takeSnapshot(stepNumber);
      case 'finish':        return { success: true, data: { finished: true } };
      default:
        return { success: false, error: `Unknown action type: ${(action as any).type}` };
    }
  }

  // ─── Navigation ─────────────────────────────────────────────────────────────

  private async goto(action: AgentAction): Promise<ActionResult> {
    const url = action.value || action.target;
    if (!url) return { success: false, error: 'goto requires a URL in value or target' };

    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    return { success: true, data: { url: this.page.url() } };
  }

  // ─── Mouse interactions ──────────────────────────────────────────────────────

  private async click(action: AgentAction): Promise<ActionResult> {
    const found = await this.findElement(action);
    if (!found) return { success: false, error: `Element not found: "${action.target}"` };

    await found.locator.click({ timeout: 10000 });
    await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});

    return { success: true, data: { strategy: found.result.strategy } };
  }

  private async doubleClick(action: AgentAction): Promise<ActionResult> {
    const found = await this.findElement(action);
    if (!found) return { success: false, error: `Element not found: "${action.target}"` };

    await found.locator.dblclick({ timeout: 10000 });
    return { success: true, data: { strategy: found.result.strategy } };
  }

  private async hover(action: AgentAction): Promise<ActionResult> {
    const found = await this.findElement(action);
    if (!found) return { success: false, error: `Element not found: "${action.target}"` };

    await found.locator.hover({ timeout: 10000 });
    return { success: true, data: { strategy: found.result.strategy } };
  }

  private async drag(action: AgentAction): Promise<ActionResult> {
    const source = await this.findElement(action);
    if (!source) return { success: false, error: `Source element not found: "${action.target}"` };

    if (!action.value) return { success: false, error: 'drag requires "value" as target drop zone description' };

    const destFound = await this.healer.findElement(action.value, this.healerOptions());
    if (!destFound) return { success: false, error: `Destination element not found: "${action.value}"` };

    await source.locator.dragTo(destFound.locator, { timeout: 15000 });
    return { success: true };
  }

  // ─── Form interactions ───────────────────────────────────────────────────────

  private async fill(action: AgentAction): Promise<ActionResult> {
    const found = await this.findElement(action);
    if (!found) return { success: false, error: `Input field not found: "${action.target}"` };

    await found.locator.fill(action.value || '', { timeout: 10000 });
    return { success: true, data: { strategy: found.result.strategy, value: action.value } };
  }

  private async typeText(action: AgentAction): Promise<ActionResult> {
    // Type into the currently focused element or the target
    if (action.target) {
      const found = await this.findElement(action);
      if (!found) return { success: false, error: `Element not found: "${action.target}"` };
      await found.locator.click();
    }

    await this.page.keyboard.type(action.value || '', { delay: 50 });
    return { success: true, data: { value: action.value } };
  }

  private async press(action: AgentAction): Promise<ActionResult> {
    const key = action.key || action.value;
    if (!key) return { success: false, error: 'press requires a key' };

    if (action.target) {
      const found = await this.findElement(action);
      if (found) await found.locator.press(key);
      else await this.page.keyboard.press(key);
    } else {
      await this.page.keyboard.press(key);
    }

    return { success: true, data: { key } };
  }

  private async select(action: AgentAction): Promise<ActionResult> {
    const found = await this.findElement(action);
    if (!found) return { success: false, error: `Select not found: "${action.target}"` };

    const value = action.value || '';
    // Try by label first, then by value
    try {
      await found.locator.selectOption({ label: value }, { timeout: 5000 });
    } catch {
      await found.locator.selectOption({ value }, { timeout: 5000 });
    }

    return { success: true, data: { strategy: found.result.strategy, value } };
  }

  private async check(action: AgentAction, shouldCheck: boolean): Promise<ActionResult> {
    const found = await this.findElement(action);
    if (!found) return { success: false, error: `Checkbox not found: "${action.target}"` };

    if (shouldCheck) {
      await found.locator.check({ timeout: 10000 });
    } else {
      await found.locator.uncheck({ timeout: 10000 });
    }

    return { success: true, data: { checked: shouldCheck } };
  }

  // ─── Page-level actions ──────────────────────────────────────────────────────

  private async scroll(action: AgentAction): Promise<ActionResult> {
    const direction = action.direction || 'down';
    const amount = action.amount || 500;

    const delta = direction === 'down' || direction === 'right' ? amount : -amount;

    if (direction === 'left' || direction === 'right') {
      await this.page.mouse.wheel(delta, 0);
    } else {
      await this.page.mouse.wheel(0, delta);
    }

    await this.page.waitForTimeout(300);
    return { success: true, data: { direction, amount } };
  }

  private async wait(action: AgentAction): Promise<ActionResult> {
    if (action.target) {
      // Wait for element to appear
      try {
        const found = await this.findElement(action);
        if (found) {
          await found.locator.waitFor({ state: 'visible', timeout: action.amount || 10000 });
          return { success: true, data: { waited: 'element', target: action.target } };
        }
      } catch { /* fall through to time wait */ }
    }

    const ms = action.amount || 1000;
    await this.page.waitForTimeout(Math.min(ms, 10000)); // Cap at 10s
    return { success: true, data: { waited: 'ms', amount: ms } };
  }

  private async upload(action: AgentAction): Promise<ActionResult> {
    const found = await this.findElement(action);
    if (!found) return { success: false, error: `File input not found: "${action.target}"` };

    const filePath = action.value;
    if (!filePath) return { success: false, error: 'upload requires a file path in value' };
    if (!fs.existsSync(filePath)) return { success: false, error: `File not found: ${filePath}` };

    await found.locator.setInputFiles(filePath);
    return { success: true, data: { file: filePath } };
  }

  private async download(action: AgentAction): Promise<ActionResult> {
    const downloadDir = path.join(this.sessionWorkspace, 'downloads');
    fs.mkdirSync(downloadDir, { recursive: true });

    const [download] = await Promise.all([
      this.page.waitForEvent('download', { timeout: 30000 }),
      action.target ? this.click(action) : Promise.resolve({ success: true }),
    ]);

    const downloadPath = path.join(downloadDir, download.suggestedFilename());
    await download.saveAs(downloadPath);

    return { success: true, data: { path: downloadPath, filename: download.suggestedFilename() } };
  }

  // ─── Assertions ──────────────────────────────────────────────────────────────

  private async assertText(action: AgentAction): Promise<ActionResult> {
    const expected = action.value;
    if (!expected) return { success: false, error: 'assertText requires value' };

    const pageText = await this.page.textContent('body') || '';
    const found = pageText.toLowerCase().includes(expected.toLowerCase());

    if (!found) {
      return { success: false, error: `Text not found on page: "${expected}"` };
    }

    return { success: true, data: { found: true, text: expected } };
  }

  private async assertVisible(action: AgentAction): Promise<ActionResult> {
    if (!action.target) return { success: false, error: 'assertVisible requires target' };

    const found = await this.findElement(action);
    if (!found) {
      return { success: false, error: `Element not visible: "${action.target}"` };
    }

    const isVisible = await found.locator.isVisible().catch(() => false);
    if (!isVisible) {
      return { success: false, error: `Element found but not visible: "${action.target}"` };
    }

    return { success: true, data: { visible: true, strategy: found.result.strategy } };
  }

  private async assertUrl(action: AgentAction): Promise<ActionResult> {
    const expected = action.value;
    if (!expected) return { success: false, error: 'assertUrl requires value' };

    const current = this.page.url();
    const matches = current.toLowerCase().includes(expected.toLowerCase()) || current === expected;

    if (!matches) {
      return { success: false, error: `URL mismatch. Expected "${expected}", got "${current}"` };
    }

    return { success: true, data: { url: current } };
  }

  private async assertRequest(action: AgentAction): Promise<ActionResult> {
    // Passive assertion — network monitoring captures this separately
    return { success: true, data: { note: 'assertRequest: check network monitor logs' } };
  }

  private async assertResponse(action: AgentAction): Promise<ActionResult> {
    return { success: true, data: { note: 'assertResponse: check network monitor logs' } };
  }

  // ─── Screenshots & Snapshots ─────────────────────────────────────────────────

  async takeScreenshot(stepNumber: number, label?: string): Promise<ActionResult> {
    const screenshotDir = path.join(this.sessionWorkspace, 'screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });

    const filename = `step-${String(stepNumber).padStart(3, '0')}${label ? `-${label}` : ''}.png`;
    const screenshotPath = path.join(screenshotDir, filename);

    await this.page.screenshot({ path: screenshotPath, fullPage: false });

    return { success: true, data: { path: screenshotPath, filename } };
  }

  private async takeSnapshot(stepNumber: number): Promise<ActionResult> {
    const snapshotDir = path.join(this.sessionWorkspace, 'snapshots');
    fs.mkdirSync(snapshotDir, { recursive: true });

    const filename = `snapshot-${String(stepNumber).padStart(3, '0')}.html`;
    const snapshotPath = path.join(snapshotDir, filename);

    const html = await this.page.content();
    fs.writeFileSync(snapshotPath, html, 'utf-8');

    return { success: true, data: { path: snapshotPath } };
  }

  // ─── Element finding helper ──────────────────────────────────────────────────

  private async findElement(action: AgentAction) {
    if (!action.target) return null;
    return this.healer.findElement(action.target, this.healerOptions(action.nth));
  }

  private healerOptions(nth?: number): HealerOptions {
    return {
      nth: nth ?? 0,
      healWithGemini: this.geminiHeal,
    };
  }
}
