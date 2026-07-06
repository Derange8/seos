import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// WARNING — a sitemap that 404s or is otherwise unreachable at its
// conventional location means search engines relying on it (rather than
// pure link-following) may miss pages entirely, independent of whether
// Seos itself can generate a correct one.
export const sitemapUnreachableRule: AuditRule = {
  id: "sitemap-unreachable",
  evaluate(page: Page): AuditFinding[] {
    if (!page.sitemapIsUnreachable) return [];
    return [
      {
        ruleId: "sitemap-unreachable",
        category: "technical",
        severity: "WARNING",
        message: "This site's sitemap.xml could not be fetched — search engines relying on it may miss pages",
      },
    ];
  },
};
