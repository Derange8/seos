import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// Distinct from broken-status-code: that rule flags a page that itself
// returns an error; this one flags a page that *links to* one — only
// meaningful once DetectBrokenLinksUseCase has run and set Link.isBroken,
// which happens before RunAuditUseCase in the CrawlJobCompleted handler
// order (see crawl-pipeline.ts).
export const brokenInternalLinksRule: AuditRule = {
  id: "broken-internal-links",
  evaluate(page: Page): AuditFinding[] {
    const brokenLinks = page.allLinks.filter((link) => link.isInternal && link.isBroken);
    if (brokenLinks.length === 0) return [];
    return [
      {
        ruleId: "broken-internal-links",
        category: "technical",
        severity: "WARNING",
        message: `${page.url.href} links to ${brokenLinks.length} internal page(s) that return an error`,
      },
    ];
  },
};
