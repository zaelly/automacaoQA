/**
 * ScreenshotManager — captures and manages screenshots during agent execution.
 *
 * Takes a screenshot after every action and stores it with metadata
 * so the HTML report can embed a visual timeline of the test run.
 */

import * as path from 'path';
import * as fs from 'fs';
import type { Page } from 'playwright';

export interface ScreenshotRecord {
  path: string;
  filename: string;
  stepNumber: number;
  label?: string;
  timestamp: string;
  base64?: string;
}

export class ScreenshotManager {
  private screenshots: ScreenshotRecord[] = [];
  private screenshotDir: string;

  constructor(private page: Page, sessionWorkspace: string) {
    this.screenshotDir = path.join(sessionWorkspace, 'screenshots');
    fs.mkdirSync(this.screenshotDir, { recursive: true });
  }

  async capture(stepNumber: number, label?: string): Promise<ScreenshotRecord | null> {
    try {
      const filename = `step-${String(stepNumber).padStart(3, '0')}${label ? `-${label.replace(/[^a-z0-9]/gi, '_')}` : ''}.png`;
      const screenshotPath = path.join(this.screenshotDir, filename);

      await this.page.screenshot({
        path: screenshotPath,
        fullPage: false,
        timeout: 5000,
      });

      const record: ScreenshotRecord = {
        path: screenshotPath,
        filename,
        stepNumber,
        label,
        timestamp: new Date().toISOString(),
      };

      this.screenshots.push(record);
      return record;
    } catch {
      return null;
    }
  }

  async captureWithBase64(stepNumber: number, label?: string): Promise<ScreenshotRecord | null> {
    const record = await this.capture(stepNumber, label);
    if (!record) return null;

    try {
      const buffer = fs.readFileSync(record.path);
      record.base64 = buffer.toString('base64');
    } catch { /* ignore */ }

    return record;
  }

  getScreenshots(): ScreenshotRecord[] {
    return [...this.screenshots];
  }

  getLatest(): ScreenshotRecord | null {
    return this.screenshots.at(-1) ?? null;
  }

  getBase64(stepNumber: number): string | null {
    const record = this.screenshots.find(s => s.stepNumber === stepNumber);
    if (!record) return null;

    try {
      return fs.readFileSync(record.path).toString('base64');
    } catch {
      return null;
    }
  }
}
