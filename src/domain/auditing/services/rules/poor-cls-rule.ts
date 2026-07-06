import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// Google's official Core Web Vitals thresholds (web.dev): Good <=0.1,
// Needs Improvement 0.11-0.25, Poor >0.25.
const POOR_THRESHOLD = 0.25;
const NEEDS_IMPROVEMENT_THRESHOLD = 0.1;

export const poorClsRule: AuditRule = {
  id: "poor-cls",
  evaluate(page: Page): AuditFinding[] {
    if (page.cls === null) return [];
    if (page.cls <= NEEDS_IMPROVEMENT_THRESHOLD) return [];

    const severity = page.cls > POOR_THRESHOLD ? "CRITICAL" : "WARNING";
    return [
      {
        ruleId: "poor-cls",
        category: "performance",
        severity,
        message: `${page.url.href} has a Cumulative Layout Shift score of ${page.cls.toFixed(3)} — Google's "Good" threshold is 0.1 or less`,
      },
    ];
  },
};
