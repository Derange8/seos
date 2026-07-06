import type { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";
import type { Slot } from "@/domain/ai-visibility/slot";
import { dominantSlot, slotConsensus, isConfident } from "@/domain/ai-visibility/slot";
import { buildScorecard, type AiVisibilityScorecard } from "@/domain/ai-visibility/services/scorecard";
import { computeAiVisibilityDelta, type AiVisibilityDelta } from "@/domain/ai-visibility/services/delta";
import type {
  CitationMovement,
  ExperimentOutcome,
  ExperimentStatus,
  VisibilityExperiment,
} from "@/domain/ai-visibility/entities/visibility-experiment";

export interface AiVisibilityCitationDto {
  url: string;
  title?: string;
}

export interface AiVisibilityQueryDto {
  query: string;
  dominantSlot: Slot;
  mentioned: number;
  contested: number;
  open: number;
  competitorsMentioned: string[];
  // How many of this query's samples cited the target's own domain, and the
  // distinct sources the answers cited (the drill-down evidence). Empty/0 for
  // a parametric run.
  citedSamples: number;
  citations: AiVisibilityCitationDto[];
  // How stable this query's dominant slot is across its samples (0..1), and
  // whether that clears the confidence bar. A low-consensus query is a
  // coin-flip, not a reliable reading — the UI/report flag it.
  consensus: number;
  confident: boolean;
}

export interface AiVisibilityRunDto {
  runAt: string;
  samplesPerQuery: number;
  // How this run was measured — the UI reads citation numbers differently for
  // a parametric run (no web search) vs a web_grounded one.
  groundingMode: string;
  // Which AI engine measured this run ("openai" | "anthropic" | "deepseek").
  engine: string;
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
  // Citation-axis reading (Faz 2), null until resolved. "GAINED" is the star
  // signal — the site entered AI-search sources after acting, even if the
  // mention slot hasn't moved yet.
  citationMovement: CitationMovement | null;
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
    citationMovement: experiment.citationMovement,
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
    groundingMode: run.groundingMode,
    engine: run.engine,
    scorecard: buildScorecard(run.outcomes),
    delta: previous ? computeAiVisibilityDelta(previous, run) : null,
    queries: run.outcomes.map((o) => ({
      query: o.query,
      dominantSlot: dominantSlot(o.slots),
      mentioned: o.slots.filter((s) => s === "MENTIONED").length,
      contested: o.slots.filter((s) => s === "CONTESTED").length,
      open: o.slots.filter((s) => s === "OPEN").length,
      competitorsMentioned: [...o.competitorsMentioned],
      citedSamples: o.citedSamples,
      citations: o.citations.map((c) => (c.title !== undefined ? { url: c.url, title: c.title } : { url: c.url })),
      consensus: slotConsensus(o.slots),
      confident: isConfident(o.slots),
    })),
  };
}
