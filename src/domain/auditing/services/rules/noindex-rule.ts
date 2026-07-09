import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// INFO, not WARNING/CRITICAL — noindex is often deliberate (login pages,
// thank-you pages, etc.), but an accidental one is a costly, easy-to-miss
// mistake, so it's worth surfacing rather than staying silent.
export const noindexRule: AuditRule = {
  id: "noindex",
  appliesToNoindexPages: true,
  isHtmlOnly: true,
  evaluate(page: Page): AuditFinding[] {
    if (!page.isNoindex) return [];
    return [
      {
        ruleId: "noindex",
        category: "technical",
        severity: "INFO",
        message: `${page.url.href} is excluded from search results via meta robots noindex — confirm this is intentional`,
      },
    ];
  },
};
