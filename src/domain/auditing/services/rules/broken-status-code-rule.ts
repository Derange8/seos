import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

export const brokenStatusCodeRule: AuditRule = {
  id: "broken-status-code",
  appliesToFailedPages: true,
  evaluate(page: Page): AuditFinding[] {
    if (!page.isBroken()) return [];
    return [
      {
        ruleId: "broken-status-code",
        category: "technical",
        severity: "CRITICAL",
        message: `${page.url.href} returned HTTP ${page.statusCode}`,
      },
    ];
  },
};
