import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

export const missingTitleRule: AuditRule = {
  id: "missing-title",
  isHtmlOnly: true,
  evaluate(page: Page): AuditFinding[] {
    if (page.title && page.title.trim().length > 0) return [];
    return [
      {
        ruleId: "missing-title",
        category: "technical",
        // WARNING, not CRITICAL — matches missing-h1/missing-meta-description.
        // A missing <title> is worth fixing but isn't a hard failure (the
        // page still renders and can still be crawled/indexed), so it
        // shouldn't dominate a "N critical issues" summary the way a
        // broken status code or blocked-by-robots page should.
        severity: "WARNING",
        message: `${page.url.href} has no <title> tag`,
      },
    ];
  },
};
