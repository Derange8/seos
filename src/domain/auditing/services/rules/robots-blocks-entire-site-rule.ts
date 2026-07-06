import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// CRITICAL — the single most damaging robots.txt mistake there is: every
// page on the site can look perfect and still get zero organic traffic
// because the site told search engines not to index any of it. A common
// real-world cause is a staging-site robots.txt left in place after
// launch.
export const robotsBlocksEntireSiteRule: AuditRule = {
  id: "robots-blocks-entire-site",
  evaluate(page: Page): AuditFinding[] {
    if (!page.robotsBlocksEntireSite) return [];
    return [
      {
        ruleId: "robots-blocks-entire-site",
        category: "technical",
        severity: "CRITICAL",
        message:
          "This site's robots.txt disallows the entire site (\"Disallow: /\") for at least one crawler — search engines are being told not to index anything",
      },
    ];
  },
};
