import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";
import { isKnownSchemaOrgType } from "@/domain/auditing/services/known-schema-org-types";

// INFO, not WARNING — an unrecognized "@type" is usually a typo (e.g.
// "Artical") or a niche schema.org type this list doesn't cover, either
// way worth a second look but not a confirmed defect the way invalid JSON
// is. One finding per page (not per unrecognized type) to avoid flooding
// a page that has several unusual types with duplicate near-identical rows.
export const unrecognizedStructuredDataTypeRule: AuditRule = {
  id: "unrecognized-structured-data-type",
  isHtmlOnly: true,
  evaluate(page: Page): AuditFinding[] {
    const unrecognized = page.structuredDataTypes.filter((type) => !isKnownSchemaOrgType(type));
    if (unrecognized.length === 0) return [];
    return [
      {
        ruleId: "unrecognized-structured-data-type",
        category: "structured_data",
        severity: "INFO",
        message: `${page.url.href} has JSON-LD with an unrecognized type (${unrecognized.join(", ")}) — check for a typo or an uncommon schema.org type`,
      },
    ];
  },
};
