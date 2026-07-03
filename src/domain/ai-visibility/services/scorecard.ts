import type { Slot } from "@/domain/ai-visibility/slot";
import { dominantSlot } from "@/domain/ai-visibility/slot";
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
  competitorFrequency: CompetitorCount[];
  winnableQueries: string[];
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

  const winnableQueries = outcomes.filter((o) => dominantSlot(o.slots) === "OPEN").map((o) => o.query);

  return {
    totalSamples: total,
    mentioned,
    contested,
    open,
    mentionedPct: pct(mentioned, total),
    contestedPct: pct(contested, total),
    openPct: pct(open, total),
    competitorFrequency,
    winnableQueries,
  };
}
