import type { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import type { PagePerformance } from "@/domain/tracking/entities/page-performance";
import { SEVERITY_PENALTY } from "@/domain/auditing/services/severity-penalty";

// P1 (most impactful) through P4 (least) — a *relative* ranking of issues
// within one audit run, not an absolute revenue/traffic figure. There's no
// honest way to estimate revenue impact without conversion-value data Seos
// doesn't have; what real GSC data *does* support is "which of this site's
// own issues sit on its own highest-traffic pages," which is what this
// ranks. hasTrafficData distinguishes "verified, this page truly gets no
// search traffic" from "no GSC data fetched for this page at all" — the
// UI must not imply a number it doesn't actually have.
export type TrafficImpactTier = "P1" | "P2" | "P3" | "P4";

export interface TrafficImpact {
  issueId: string;
  pageImpressions: number;
  pageClicks: number;
  hasTrafficData: boolean;
  tier: TrafficImpactTier;
}

function tierForPercentile(percentile: number): TrafficImpactTier {
  if (percentile < 0.25) return "P1";
  if (percentile < 0.5) return "P2";
  if (percentile < 0.75) return "P3";
  return "P4";
}

// THINK layer: ranks issues by (severity x real page traffic) so the user
// knows which issue to act on first when revenue data isn't available but
// real search-traffic data is. Combining severity with traffic — rather
// than traffic alone — keeps a CRITICAL issue on a low-traffic page from
// being buried under an INFO issue on a high-traffic one; severity is
// still the project's own signal of "how wrong is this," traffic only
// breaks ties and amplifies within that.
export function calculateTrafficImpact(
  issues: readonly AuditIssue[],
  pageUrlsByPageId: ReadonlyMap<string, string>,
  pagePerformance: readonly PagePerformance[]
): readonly TrafficImpact[] {
  const performanceByUrl = new Map(pagePerformance.map((row) => [row.pageUrl, row]));

  const scored = issues.map((issue) => {
    const pageUrl = pageUrlsByPageId.get(issue.pageId);
    const performance = pageUrl ? performanceByUrl.get(pageUrl) : undefined;
    const impressions = performance?.impressions ?? 0;
    return {
      issueId: issue.id,
      pageImpressions: impressions,
      pageClicks: performance?.clicks ?? 0,
      hasTrafficData: performance !== undefined,
      combinedScore: SEVERITY_PENALTY[issue.severity] * (1 + impressions),
    };
  });

  const sorted = [...scored].sort((a, b) => b.combinedScore - a.combinedScore);
  const rankByIssueId = new Map(sorted.map((entry, index) => [entry.issueId, index]));

  return scored.map((entry) => ({
    issueId: entry.issueId,
    pageImpressions: entry.pageImpressions,
    pageClicks: entry.pageClicks,
    hasTrafficData: entry.hasTrafficData,
    tier: tierForPercentile((rankByIssueId.get(entry.issueId) ?? 0) / issues.length),
  }));
}
