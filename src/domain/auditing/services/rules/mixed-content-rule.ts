import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

export const mixedContentRule: AuditRule = {
  id: "mixed-content",
  evaluate(page: Page): AuditFinding[] {
    if (page.mixedContentCount === 0) return [];
    return [
      {
        ruleId: "mixed-content",
        category: "technical",
        severity: "WARNING",
        message: `${page.url.href} loads ${page.mixedContentCount} resource(s) over plain HTTP on an HTTPS page`,
      },
    ];
  },
};
