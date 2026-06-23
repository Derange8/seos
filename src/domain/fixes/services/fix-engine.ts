import type { Page } from "@/domain/crawling/entities/page";
import type { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import type { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import type { FixGenerator } from "@/domain/fixes/services/fix-generator";
import { DEFAULT_FIX_GENERATORS } from "@/domain/fixes/services/generators";
import type { KeywordOpportunity } from "@/domain/tracking/entities/keyword-opportunity";
import { selectBestOpportunityByPageUrl } from "@/domain/fixes/services/keyword-opportunity-selector";

// For each issue, find the generator that addresses its ruleId and run it
// against the page it's about. Issues with no matching generator (e.g.
// thin-content, broken-status-code) produce nothing — not every SEO
// problem is generatable content, some genuinely need a human decision.
// keywordOpportunities defaults to empty so this stays fully usable before
// (or without) a Google connection — generators just fall back to their
// template logic, same "absence is a normal state, not an error" pattern
// used throughout this codebase.
export function generateFixCandidates(
  issues: readonly AuditIssue[],
  pagesById: ReadonlyMap<string, Page>,
  generators: readonly FixGenerator[] = DEFAULT_FIX_GENERATORS,
  keywordOpportunities: readonly KeywordOpportunity[] = []
): FixCandidate[] {
  const candidates: FixCandidate[] = [];
  const bestOpportunityByPageUrl = selectBestOpportunityByPageUrl(keywordOpportunities);

  for (const issue of issues) {
    const generator = generators.find((candidate) => candidate.ruleIds.includes(issue.ruleId));
    if (!generator) continue;

    const page = pagesById.get(issue.pageId);
    if (!page) continue;

    const candidate = generator.generate(page, issue, {
      topKeywordOpportunity: bestOpportunityByPageUrl.get(page.url.href) ?? null,
    });
    if (candidate) candidates.push(candidate);
  }

  return candidates;
}
