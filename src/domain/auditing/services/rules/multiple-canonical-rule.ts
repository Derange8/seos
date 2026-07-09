import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

export const multipleCanonicalRule: AuditRule = {
  id: "multiple-canonical",
  isHtmlOnly: true,
  evaluate(page: Page): AuditFinding[] {
    if (page.canonicalTagCount <= 1) return [];
    return [
      {
        ruleId: "multiple-canonical",
        category: "technical",
        severity: "WARNING",
        message: `${page.url.href} has ${page.canonicalTagCount} <link rel="canonical"> tags — search engines may pick the wrong one`,
      },
    ];
  },
};
