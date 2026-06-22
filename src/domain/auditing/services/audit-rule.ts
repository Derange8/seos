import type { Page } from "@/domain/crawling/entities/page";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";

// The plugin extension point: a rule is a pure function of one already-
// crawled Page, with no I/O — that's what keeps the audit engine fast
// enough to run synchronously right after a crawl finishes. Rules that need
// to compare *across* pages (duplicate content, orphan pages, etc.) instead
// run as a separate post-crawl use case that sets a flag on each Page (see
// DetectBrokenLinksUseCase, DetectDuplicateContentUseCase,
// DetectOrphanPagesUseCase), which a plain single-page rule then just reads.
export interface AuditRule {
  readonly id: string;
  evaluate(page: Page): AuditFinding[];
}
