import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// Google's official Core Web Vitals thresholds (web.dev): Good <=2500ms,
// Needs Improvement 2501-4000ms, Poor >4000ms.
const POOR_THRESHOLD_MS = 4000;
const NEEDS_IMPROVEMENT_THRESHOLD_MS = 2500;

export const poorLcpRule: AuditRule = {
  id: "poor-lcp",
  evaluate(page: Page): AuditFinding[] {
    if (page.lcpMs === null) return [];
    if (page.lcpMs <= NEEDS_IMPROVEMENT_THRESHOLD_MS) return [];

    const severity = page.lcpMs > POOR_THRESHOLD_MS ? "CRITICAL" : "WARNING";
    return [
      {
        ruleId: "poor-lcp",
        category: "performance",
        severity,
        message: `${page.url.href} has a Largest Contentful Paint of ${Math.round(page.lcpMs)}ms — Google's "Good" threshold is 2500ms or less`,
      },
    ];
  },
};
