import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

export const duplicateContentRule: AuditRule = {
  id: "duplicate-content",
  evaluate(page: Page): AuditFinding[] {
    if (!page.hasDuplicateContent) return [];
    return [
      {
        ruleId: "duplicate-content",
        category: "content",
        severity: "WARNING",
        message: `${page.url.href} has the exact same visible content as at least one other page on this site`,
      },
    ];
  },
};
