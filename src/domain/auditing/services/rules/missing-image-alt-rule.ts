import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

export const missingImageAltRule: AuditRule = {
  id: "missing-image-alt",
  // Accessibility, not search-ranking — a real visitor on a noindex'd
  // (e.g. logged-in) page still relies on alt text the same as anyone else.
  appliesToNoindexPages: true,
  isHtmlOnly: true,
  evaluate(page: Page): AuditFinding[] {
    if (page.imagesMissingAltCount === 0) return [];
    return [
      {
        ruleId: "missing-image-alt",
        category: "content",
        severity: "WARNING",
        message: `${page.url.href} has ${page.imagesMissingAltCount} image(s) with no alt attribute`,
      },
    ];
  },
};
