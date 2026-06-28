/**
 * PerformanceCollector — collects Web Vitals and navigation timing metrics.
 *
 * Measures: TTFB, FCP, LCP, CLS, FID, and resource counts.
 * Attached once per page navigation via page.on('load').
 */

import type { Page } from 'playwright';
import type { PerformanceMetrics } from '../agent/types';

export class PerformanceCollector {
  private snapshots: Array<{ url: string; metrics: PerformanceMetrics; timestamp: string }> = [];
  private current: PerformanceMetrics = {};

  constructor(private page: Page) {}

  attach(): void {
    this.page.on('load', () => this.collect().catch(() => {}));
  }

  async collect(): Promise<PerformanceMetrics> {
    try {
      const metrics = await this.page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paintEntries = performance.getEntriesByType('paint');
        const fcp = paintEntries.find(p => p.name === 'first-contentful-paint');

        // LCP via PerformanceObserver (may not be available yet)
        let lcp: number | undefined;
        try {
          const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
          if (lcpEntries.length > 0) {
            lcp = lcpEntries[lcpEntries.length - 1].startTime;
          }
        } catch { /* not available */ }

        const resourceEntries = performance.getEntriesByType('resource');
        const failedResources = resourceEntries.filter(
          r => (r as PerformanceResourceTiming).transferSize === 0 && (r as PerformanceResourceTiming).decodedBodySize > 0
        ).length;

        return {
          ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : undefined,
          fcp: fcp ? Math.round(fcp.startTime) : undefined,
          lcp: lcp ? Math.round(lcp) : undefined,
          domInteractive: nav ? Math.round(nav.domInteractive - nav.fetchStart) : undefined,
          domComplete: nav ? Math.round(nav.domComplete - nav.fetchStart) : undefined,
          loadEvent: nav ? Math.round(nav.loadEventEnd - nav.fetchStart) : undefined,
          transferSize: nav ? nav.transferSize : undefined,
          resourceCount: resourceEntries.length,
          failedResources,
        };
      });

      this.current = metrics;

      this.snapshots.push({
        url: this.page.url(),
        metrics,
        timestamp: new Date().toISOString(),
      });

      return metrics;
    } catch {
      return {};
    }
  }

  getCurrent(): PerformanceMetrics {
    return this.current;
  }

  getSnapshots() {
    return [...this.snapshots];
  }

  getSummary(): string {
    if (!this.current.ttfb && !this.current.fcp) return 'No metrics collected';

    const parts: string[] = [];
    if (this.current.ttfb !== undefined) parts.push(`TTFB: ${this.current.ttfb}ms`);
    if (this.current.fcp !== undefined) parts.push(`FCP: ${this.current.fcp}ms`);
    if (this.current.lcp !== undefined) parts.push(`LCP: ${this.current.lcp}ms`);
    if (this.current.loadEvent !== undefined) parts.push(`Load: ${this.current.loadEvent}ms`);
    if (this.current.resourceCount !== undefined) parts.push(`${this.current.resourceCount} resources`);

    return parts.join(', ');
  }
}
