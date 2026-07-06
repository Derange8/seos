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
  // meaningful when BOTH runs were web-grounded — a parametric run has no
  // citations (citedPct always 0), so a parametric→web_grounded pair would
  // otherwise show a fabricated gain (the same mode-mismatch classifyCitation-
  // Movement guards against). citedComparable is false in that case, and
  // citedPctDelta is forced to 0; callers must hide the cited figure when
  // citedComparable is false rather than reading citedPctDelta.
  citedPctDelta: number;
  citedComparable: boolean;
  // False when the two runs were measured by different engines (e.g. an OpenAI
  // run vs an Anthropic run). Those are different answer surfaces — comparing
  // their percentages is meaningless — so callers should suppress the delta
  // and tell the user the runs aren't comparable rather than show noise.
  sameEngine: boolean;
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

  // Different engines are different answer surfaces; comparing their numbers is
  // meaningless. When the runs disagree on engine, the whole delta is zeroed and
  // flagged — the slot `changes` list is also dropped (a "CONTESTED → OPEN"
  // across engines isn't a real move).
  const sameEngine = previous.engine === current.engine;

  // Citation is comparable only when both ends measured it (both web-grounded)
  // AND on the same engine. Otherwise a parametric baseline (or a cross-engine
  // pair) would fabricate a citation gain.
  const citedComparable =
    sameEngine && previous.groundingMode === "web_grounded" && current.groundingMode === "web_grounded";

  return {
    previousRunAt: previous.runAt.toISOString(),
    mentionedPctDelta: sameEngine ? curr.mentionedPct - prev.mentionedPct : 0,
    openPctDelta: sameEngine ? curr.openPct - prev.openPct : 0,
    contestedPctDelta: sameEngine ? curr.contestedPct - prev.contestedPct : 0,
    citedPctDelta: citedComparable ? curr.citedPct - prev.citedPct : 0,
    citedComparable,
    sameEngine,
    changes: sameEngine ? changes : [],
  };
}
