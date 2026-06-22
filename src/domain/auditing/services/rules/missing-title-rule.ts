import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

export const missingTitleRule: AuditRule = {
  id: "missing-title",
  evaluate(page: Page): AuditFinding[] {
    if (page.title && page.title.trim().length > 0) return [];
    return [
      {
        ruleId: "missing-title",
        category: "technical",
        severity: "CRITICAL",
        message: `${page.url.href} has no <title> tag`,
      },
    ];
  },
};
