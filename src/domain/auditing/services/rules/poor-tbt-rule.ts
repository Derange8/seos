import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// Lighthouse's own mobile TBT thresholds: fast <=200ms, moderate
// 200-600ms, slow >600ms. TBT is the lab-measurable proxy for INP used
// here — see WebVitalsMeasurement.tbtMs for why INP itself can't be
// measured from an unattended crawl.
const POOR_THRESHOLD_MS = 600;
const NEEDS_IMPROVEMENT_THRESHOLD_MS = 200;

export const poorTbtRule: AuditRule = {
  id: "poor-tbt",
  evaluate(page: Page): AuditFinding[] {
    if (page.tbtMs === null) return [];
    if (page.tbtMs <= NEEDS_IMPROVEMENT_THRESHOLD_MS) return [];

    const severity = page.tbtMs > POOR_THRESHOLD_MS ? "CRITICAL" : "WARNING";
    return [
      {
        ruleId: "poor-tbt",
        category: "performance",
        severity,
        message: `${page.url.href} has a Total Blocking Time of ${Math.round(page.tbtMs)}ms — heavy main-thread work may make the page feel unresponsive (Lighthouse's "fast" threshold is 200ms or less)`,
      },
    ];
  },
};
