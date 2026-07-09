import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// Presence-only check (see CheerioHtmlParser.detectStructuredData) — INFO,
// not WARNING, since the absence of JSON-LD is an opportunity rather than
// a defect, same severity rationale as missing-canonical.
export const missingStructuredDataRule: AuditRule = {
  id: "missing-structured-data",
  isHtmlOnly: true,
  evaluate(page: Page): AuditFinding[] {
    if (page.hasStructuredData) return [];
    return [
      {
        ruleId: "missing-structured-data",
        category: "structured_data",
        severity: "INFO",
        message: `${page.url.href} has no structured data (JSON-LD) — adding e.g. Organization or BreadcrumbList markup helps search engines understand the page`,
      },
    ];
  },
};
