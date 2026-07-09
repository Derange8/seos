import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

export const missingMetaDescriptionRule: AuditRule = {
  id: "missing-meta-description",
  isHtmlOnly: true,
  evaluate(page: Page): AuditFinding[] {
    if (page.metaDescription && page.metaDescription.trim().length > 0) return [];
    return [
      {
        ruleId: "missing-meta-description",
        category: "content",
        severity: "WARNING",
        message: `${page.url.href} has no meta description`,
      },
    ];
  },
};
