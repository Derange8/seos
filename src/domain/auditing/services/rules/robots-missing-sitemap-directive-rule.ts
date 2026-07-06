import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// INFO, not a defect — search engines can discover a sitemap other ways
// (Search Console submission, guessing /sitemap.xml), but pointing at it
// from robots.txt is the one mechanism every crawler checks with zero
// manual setup, so a live robots.txt missing it is worth flagging.
export const robotsMissingSitemapDirectiveRule: AuditRule = {
  id: "robots-missing-sitemap-directive",
  evaluate(page: Page): AuditFinding[] {
    if (page.robotsMissingSitemapDirective !== true) return [];
    return [
      {
        ruleId: "robots-missing-sitemap-directive",
        category: "technical",
        severity: "INFO",
        message: "This site's robots.txt has no \"Sitemap:\" directive pointing crawlers at the sitemap",
      },
    ];
  },
};
