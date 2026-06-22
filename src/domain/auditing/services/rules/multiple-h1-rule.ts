import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

export const multipleH1Rule: AuditRule = {
  id: "multiple-h1",
  evaluate(page: Page): AuditFinding[] {
    if (page.h1Count <= 1) return [];
    return [
      {
        ruleId: "multiple-h1",
        category: "content",
        severity: "WARNING",
        message: `${page.url.href} has ${page.h1Count} <h1> elements — a page should have exactly one`,
      },
    ];
  },
};
