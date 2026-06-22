import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

export const duplicateMetaDescriptionRule: AuditRule = {
  id: "duplicate-meta-description",
  evaluate(page: Page): AuditFinding[] {
    if (!page.hasDuplicateMetaDescription) return [];
    return [
      {
        ruleId: "duplicate-meta-description",
        category: "content",
        severity: "WARNING",
        message: `${page.url.href} shares its meta description with at least one other page on this site`,
      },
    ];
  },
};
