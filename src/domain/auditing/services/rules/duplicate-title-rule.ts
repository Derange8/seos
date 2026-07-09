import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// Only meaningful once DetectDuplicateContentUseCase has run and set
// Page.hasDuplicateTitle, which happens before RunAuditUseCase in the
// CrawlJobCompleted handler order (see crawl-pipeline.ts) — same dependency
// broken-internal-links-rule has on DetectBrokenLinksUseCase.
export const duplicateTitleRule: AuditRule = {
  id: "duplicate-title",
  isHtmlOnly: true,
  evaluate(page: Page): AuditFinding[] {
    if (!page.hasDuplicateTitle) return [];
    return [
      {
        ruleId: "duplicate-title",
        category: "content",
        severity: "WARNING",
        message: `${page.url.href} shares its title with at least one other page on this site`,
      },
    ];
  },
};
