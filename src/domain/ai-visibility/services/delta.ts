import type { Slot } from "@/domain/ai-visibility/slot";
import { dominantSlot } from "@/domain/ai-visibility/slot";
import type { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";
import { buildScorecard } from "@/domain/ai-visibility/services/scorecard";

export interface AiVisibilitySlotChange {
  query: string;
  from: Slot;
  to: Slot;
}

// The movement between two probe runs — the payoff of re-measuring after
// acting on a diagnosis. Percentage deltas are current-minus-previous
// (positive mentioned/open is good); changes lists only queries present in
// both runs whose dominant slot actually moved.
export interface AiVisibilityDelta {
  previousRunAt: string;
  mentionedPctDelta: number;
  openPctDelta: number;
  contestedPctDelta: number;
  // Citation-axis movement (Faz 2): current minus previous cited %. Only
  // meaningful when both runs were web-grounded; a mode mismatch (e.g. a
  // parametric run against a web-grounded one) makes this noise, so callers
  // read it alongside each run's groundingMode.
  citedPctDelta: number;
  changes: AiVisibilitySlotChange[];
}

export function computeAiVisibilityDelta(
  previous: AiVisibilityProbeRun,
  current: AiVisibilityProbeRun
): AiVisibilityDelta {
  const prev = buildScorecard(previous.outcomes);
  const curr = buildScorecard(current.outcomes);

  const prevSlotByQuery = new Map<string, Slot>();
  for (const o of previous.outcomes) prevSlotByQuery.set(o.query, dominantSlot(o.slots));

  const changes: AiVisibilitySlotChange[] = [];
  for (const o of current.outcomes) {
    const from = prevSlotByQuery.get(o.query);
    if (from === undefined) continue; // query wasn't in the previous run
    const to = dominantSlot(o.slots);
    if (from !== to) changes.push({ query: o.query, from, to });
  }

  return {
    previousRunAt: previous.runAt.toISOString(),
    mentionedPctDelta: curr.mentionedPct - prev.mentionedPct,
    openPctDelta: curr.openPct - prev.openPct,
    contestedPctDelta: curr.contestedPct - prev.contestedPct,
    citedPctDelta: curr.citedPct - prev.citedPct,
    changes,
  };
}
