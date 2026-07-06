import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// WARNING — the sitemap was reachable (sitemap-unreachable-rule already
// covers the "couldn't fetch it at all" case) but isn't well-formed XML,
// e.g. a server serving an HTML error page with a 200 status, or a
// truncated/hand-edited file. Search engines will simply ignore it.
export const sitemapInvalidXmlRule: AuditRule = {
  id: "sitemap-invalid-xml",
  evaluate(page: Page): AuditFinding[] {
    if (page.sitemapIsInvalidXml !== true) return [];
    return [
      {
        ruleId: "sitemap-invalid-xml",
        category: "technical",
        severity: "WARNING",
        message: "This site's sitemap.xml is not valid XML — search engines will ignore it",
      },
    ];
  },
};
