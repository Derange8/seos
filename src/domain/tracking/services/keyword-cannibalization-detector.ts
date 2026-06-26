import type { PageQueryPerformance } from "@/application/tracking/ports/search-console-client-port";
import { KeywordCannibalizationIssue } from "@/domain/tracking/entities/keyword-cannibalization";

// Same noise filter as FetchKeywordOpportunitiesUseCase's MIN_IMPRESSIONS —
// a page with a couple of stray impressions on a query isn't "competing"
// for it, it's just GSC's long tail. Both pages need to clear this bar for
// the overlap to mean anything.
const MIN_IMPRESSIONS_PER_PAGE = 10;

// Keyword cannibalization: two or more distinct pages on the same site
// both drawing meaningful impressions for the same query — they're
// splitting (and likely suppressing) each other's ranking instead of one
// page consolidating it. Pure function over whatever rows the same GSC
// fetch already pulled (see FetchKeywordOpportunitiesUseCase) — no
// separate API call.
export function detectKeywordCannibalization(
  projectId: string,
  rows: readonly PageQueryPerformance[]
): KeywordCannibalizationIssue[] {
  const rowsByQuery = new Map<string, PageQueryPerformance[]>();
  for (const row of rows) {
    if (row.impressions < MIN_IMPRESSIONS_PER_PAGE) continue;
    const existing = rowsByQuery.get(row.query) ?? [];
    existing.push(row);
    rowsByQuery.set(row.query, existing);
  }

  const issues: KeywordCannibalizationIssue[] = [];
  for (const [query, queryRows] of rowsByQuery) {
    const distinctPages = new Set(queryRows.map((row) => row.page));
    if (distinctPages.size < 2) continue;

    const pages = queryRows
      .map((row) => ({
        pageUrl: row.page,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }))
      .sort((a, b) => b.impressions - a.impressions);

    issues.push(KeywordCannibalizationIssue.create(projectId, query, pages));
  }

  return issues;
}
