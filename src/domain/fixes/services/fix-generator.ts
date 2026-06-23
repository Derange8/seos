import type { Page } from "@/domain/crawling/entities/page";
import type { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import type { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import type { KeywordOpportunity } from "@/domain/tracking/entities/keyword-opportunity";

// Real GSC signal for the page a fix is being generated for — null when no
// Google connection exists yet, or the page has no striking-distance query
// (most pages, most of the time). Generators that ignore this still work
// exactly as before; it exists so title/meta-description fixes can target
// a real ranking-relevant keyword instead of a generic template when one
// is available.
export interface FixGeneratorContext {
  topKeywordOpportunity: KeywordOpportunity | null;
}

export interface FixGenerator {
  // Which audit rule id(s) this generator addresses — e.g. title-length and
  // missing-title both produce a TITLE fix from the same generator.
  readonly ruleIds: readonly string[];
  // May return null if there's truly nothing to generate from — generators
  // below always have at least a URL-derived fallback, but the contract
  // allows a future generator to decline rather than fabricate. context is
  // optional so existing call sites/tests passing just (page, issue) keep
  // compiling unchanged.
  generate(page: Page, issue: AuditIssue, context?: FixGeneratorContext): FixCandidate | null;
}
