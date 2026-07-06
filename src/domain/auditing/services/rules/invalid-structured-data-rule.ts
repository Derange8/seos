import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// WARNING, not INFO like missing-structured-data — a script tag that fails
// to parse means a page author tried to add JSON-LD and got it wrong, not
// a page that simply never had any. Silently treating it as "no structured
// data" (the pre-fix behavior) hides a real authoring mistake.
export const invalidStructuredDataRule: AuditRule = {
  id: "invalid-structured-data",
  evaluate(page: Page): AuditFinding[] {
    if (!page.hasInvalidStructuredData) return [];
    return [
      {
        ruleId: "invalid-structured-data",
        category: "structured_data",
        severity: "WARNING",
        message: `${page.url.href} has a JSON-LD block that isn't valid JSON — search engines will ignore it entirely`,
      },
    ];
  },
};
