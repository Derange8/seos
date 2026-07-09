import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

export const missingH1Rule: AuditRule = {
  id: "missing-h1",
  isHtmlOnly: true,
  evaluate(page: Page): AuditFinding[] {
    if (page.h1 && page.h1.trim().length > 0) return [];
    return [
      {
        ruleId: "missing-h1",
        category: "content",
        severity: "WARNING",
        message: `${page.url.href} has no <h1> heading`,
      },
    ];
  },
};
