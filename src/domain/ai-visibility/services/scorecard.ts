import type { Slot } from "@/domain/ai-visibility/slot";
import { dominantSlot, isConfident } from "@/domain/ai-visibility/slot";
import type { QueryOutcome } from "@/domain/ai-visibility/entities/probe-run";

export interface CompetitorCount {
  name: string;
  // How many distinct queries this competitor showed up in.
  queryCount: number;
}

// The trustworthy, sample-level reading of a whole probe run — the product's
// north-star numbers. Percentages are over individual samples (the honest
// denominator); winnableQueries is over queries (a query whose plurality slot
// is OPEN is where the target has the clearest shot at getting recommended).
export interface AiVisibilityScorecard {
  totalSamples: number;
  mentioned: number;
  contested: number;
  open: number;
  mentionedPct: number;
  contestedPct: number;
  openPct: number;
  // Citation is a second, independent axis from the mention slot: in how many
  // samples the answer cited the target's own domain. A query can be OPEN
  // (not named in the prose) yet CITED (its site is in the sources) — the
  // "read but not recommended" case, the sharpest fixable gap. Always 0 for a
  // parametric run (no web search), so read it alongside the run's grounding
  // mode, not on its own.
  citedSamples: number;
  citedPct: number;
  competitorFrequency: CompetitorCount[];
  // Queries whose dominant slot is OPEN AND whose reading is stable enough to
  // trust (see isConfident) — a low-consensus OPEN is NOT surfaced as a real
  // opportunity here, it goes to lowConfidenceQueries instead.
  winnableQueries: string[];
  // Queries whose sample distribution is too split to trust the dominant slot
  // (below the consensus threshold) — "measure again / add samples" rather
  // than a confident reading either way.
  lowConfidenceQueries: string[];
}

function pct(n: number, total: number): number {
  return total ? Math.round((n / total) * 100) : 0;
}

export function buildScorecard(outcomes: readonly QueryOutcome[]): AiVisibilityScorecard {
  const allSlots: Slot[] = outcomes.flatMap((o) => [...o.slots]);
  const total = allSlots.length;
  const mentioned = allSlots.filter((s) => s === "MENTIONED").length;
  const contested = allSlots.filter((s) => s === "CONTESTED").length;
  const open = allSlots.filter((s) => s === "OPEN").length;

  const freq = new Map<string, number>();
  for (const o of outcomes) for (const c of o.competitorsMentioned) freq.set(c, (freq.get(c) ?? 0) + 1);
  const competitorFrequency: CompetitorCount[] = [...freq.entries()]
    .map(([name, queryCount]) => ({ name, queryCount }))
    .sort((a, b) => b.queryCount - a.queryCount);

  // A winnable query must be OPEN by plurality AND a confident reading — a
  // low-consensus OPEN is a coin-flip, not an opportunity to act on.
  const winnableQueries = outcomes
    .filter((o) => dominantSlot(o.slots) === "OPEN" && isConfident(o.slots))
    .map((o) => o.query);
  const lowConfidenceQueries = outcomes.filter((o) => !isConfident(o.slots)).map((o) => o.query);

  // Sample-level citation count, same denominator as the slot percentages so
  // "cited %" reads on the same footing as "mentioned %".
  const citedSamples = outcomes.reduce((sum, o) => sum + o.citedSamples, 0);

  return {
    totalSamples: total,
    mentioned,
    contested,
    open,
    mentionedPct: pct(mentioned, total),
    contestedPct: pct(contested, total),
    openPct: pct(open, total),
    citedSamples,
    citedPct: pct(citedSamples, total),
    competitorFrequency,
    winnableQueries,
    lowConfidenceQueries,
  };
}
