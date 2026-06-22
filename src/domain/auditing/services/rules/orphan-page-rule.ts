import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

export const orphanPageRule: AuditRule = {
  id: "orphan-page",
  evaluate(page: Page): AuditFinding[] {
    if (!page.isOrphan) return [];
    return [
      {
        ruleId: "orphan-page",
        category: "technical",
        severity: "WARNING",
        message: `${page.url.href} has no internal links pointing to it from anywhere else on the site`,
      },
    ];
  },
};
