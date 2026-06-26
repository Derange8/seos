import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// Server response time, not a full Core Web Vitals measurement (no LCP/
// CLS/INP here) — but it's a real, already-measured number, and a slow
// server response puts a floor under every Core Web Vital that follows it.
// 2000ms mirrors the commonly cited "good TTFB" ceiling.
const SLOW_THRESHOLD_MS = 2000;

export const slowResponseTimeRule: AuditRule = {
  id: "slow-response-time",
  appliesToNoindexPages: true,
  evaluate(page: Page): AuditFinding[] {
    if (page.responseTimeMs === null || page.responseTimeMs < SLOW_THRESHOLD_MS) return [];
    return [
      {
        ruleId: "slow-response-time",
        category: "performance",
        severity: "WARNING",
        message: `${page.url.href} took ${page.responseTimeMs}ms to respond (recommended: under ${SLOW_THRESHOLD_MS}ms)`,
      },
    ];
  },
};
