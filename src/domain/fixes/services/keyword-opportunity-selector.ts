import type { KeywordOpportunity } from "@/domain/tracking/entities/keyword-opportunity";

// "Best" = highest real search volume (impressions) the page is already
// getting for a striking-distance query, tie-broken by the better (lower)
// position — that's the single most actionable keyword to write a fix
// around, not necessarily the page's primary topic. One per page: a title
// or meta description can only meaningfully target one phrase at a time
// without becoming keyword-stuffed.
export function selectBestOpportunityByPageUrl(
  opportunities: readonly KeywordOpportunity[]
): ReadonlyMap<string, KeywordOpportunity> {
  const best = new Map<string, KeywordOpportunity>();

  for (const opportunity of opportunities) {
    const current = best.get(opportunity.pageUrl);
    if (
      !current ||
      opportunity.impressions > current.impressions ||
      (opportunity.impressions === current.impressions && opportunity.position < current.position)
    ) {
      best.set(opportunity.pageUrl, opportunity);
    }
  }

  return best;
}
