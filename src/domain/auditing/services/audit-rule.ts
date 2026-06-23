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
  // Almost every rule is a content-quality check that's meaningless against
  // a page that errored (a 404/500 page's title isn't worth optimizing) —
  // so the engine skips pages where Page.isBroken() (statusCode >= 400) by
  // default. A page with no statusCode recorded yet (null — not a known
  // failure) still runs normally. Only a rule that specifically reports ON
  // the failure itself (broken-status-code) needs to opt back in.
  readonly appliesToFailedPages?: boolean;
  evaluate(page: Page): AuditFinding[];
}
