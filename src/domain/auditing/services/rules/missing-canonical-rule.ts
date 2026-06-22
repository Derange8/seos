import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

export const missingCanonicalRule: AuditRule = {
  id: "missing-canonical",
  evaluate(page: Page): AuditFinding[] {
    if (page.canonicalUrl && page.canonicalUrl.trim().length > 0) return [];
    return [
      {
        ruleId: "missing-canonical",
        category: "technical",
        severity: "INFO",
        message: `${page.url.href} has no canonical URL`,
      },
    ];
  },
};
