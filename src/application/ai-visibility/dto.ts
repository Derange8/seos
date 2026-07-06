import type { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";
import type { Slot } from "@/domain/ai-visibility/slot";
import { dominantSlot } from "@/domain/ai-visibility/slot";
import { buildScorecard, type AiVisibilityScorecard } from "@/domain/ai-visibility/services/scorecard";
import { computeAiVisibilityDelta, type AiVisibilityDelta } from "@/domain/ai-visibility/services/delta";
import type {
  ExperimentOutcome,
  ExperimentStatus,
  VisibilityExperiment,
} from "@/domain/ai-visibility/entities/visibility-experiment";

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
  // Movement vs the previous run, when one exists — the re-measure payoff.
  delta: AiVisibilityDelta | null;
}

export interface VisibilityExperimentDto {
  id: string;
  query: string;
  baselineSlot: Slot;
  actionAt: string;
  status: ExperimentStatus;
  outcomeSlot: Slot | null;
  outcome: ExperimentOutcome | null;
}

export function toVisibilityExperimentDto(experiment: VisibilityExperiment): VisibilityExperimentDto {
  return {
    id: experiment.id,
    query: experiment.query,
    baselineSlot: experiment.baselineSlot,
    actionAt: experiment.actionAt.toISOString(),
    status: experiment.status,
    outcomeSlot: experiment.outcomeSlot,
    outcome: experiment.outcome,
  };
}

export interface AiVisibilityTrendPointDto {
  runAt: string;
  mentionedPct: number;
  contestedPct: number;
  openPct: number;
}

// Oldest-first (chart reading order), unlike findRecentByProjectId's own
// most-recent-first ordering — the trend chart plots left-to-right as time
// moves forward.
export function toAiVisibilityTrendDto(runs: readonly AiVisibilityProbeRun[]): AiVisibilityTrendPointDto[] {
  return [...runs]
    .sort((a, b) => a.runAt.getTime() - b.runAt.getTime())
    .map((run) => {
      const scorecard = buildScorecard(run.outcomes);
      return {
        runAt: run.runAt.toISOString(),
        mentionedPct: scorecard.mentionedPct,
        contestedPct: scorecard.contestedPct,
        openPct: scorecard.openPct,
      };
    });
}

export function toAiVisibilityRunDto(
  run: AiVisibilityProbeRun,
  previous: AiVisibilityProbeRun | null = null
): AiVisibilityRunDto {
  return {
    runAt: run.runAt.toISOString(),
    samplesPerQuery: run.samplesPerQuery,
    scorecard: buildScorecard(run.outcomes),
    delta: previous ? computeAiVisibilityDelta(previous, run) : null,
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
