import type { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";
import type { Slot } from "@/domain/ai-visibility/slot";
import { dominantSlot } from "@/domain/ai-visibility/slot";
import { buildScorecard, type AiVisibilityScorecard } from "@/domain/ai-visibility/services/scorecard";

export interface AiVisibilityQueryDto {
  query: string;
  dominantSlot: Slot;
  mentioned: number;
  contested: number;
  open: number;
  competitorsMentioned: string[];
}

export interface AiVisibilityRunDto {
  runAt: string;
  samplesPerQuery: number;
  scorecard: AiVisibilityScorecard;
  queries: AiVisibilityQueryDto[];
}

export function toAiVisibilityRunDto(run: AiVisibilityProbeRun): AiVisibilityRunDto {
  return {
    runAt: run.runAt.toISOString(),
    samplesPerQuery: run.samplesPerQuery,
    scorecard: buildScorecard(run.outcomes),
    queries: run.outcomes.map((o) => ({
      query: o.query,
      dominantSlot: dominantSlot(o.slots),
      mentioned: o.slots.filter((s) => s === "MENTIONED").length,
      contested: o.slots.filter((s) => s === "CONTESTED").length,
      open: o.slots.filter((s) => s === "OPEN").length,
      competitorsMentioned: [...o.competitorsMentioned],
    })),
  };
}
