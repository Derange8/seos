import { dominantSlot } from "@/domain/ai-visibility/slot";
import type { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";
import type { VisibilityExperimentRepositoryPort } from "@/application/ai-visibility/ports/visibility-experiment-repository-port";

export interface ResolveVisibilityExperimentsDeps {
  experimentRepository: VisibilityExperimentRepositoryPort;
}

// After a new probe run, resolve any open experiment whose query this run
// re-measured — recording the post-action slot as the outcome. Only resolves
// with a run that happened AFTER the action (a genuine re-measure, never the
// same baseline run). Runs inline after a probe saves; failures here must not
// break the probe, so the caller wraps it.
export class ResolveVisibilityExperimentsUseCase {
  constructor(private readonly deps: ResolveVisibilityExperimentsDeps) {}

  async execute(projectId: string, run: AiVisibilityProbeRun): Promise<void> {
    const open = await this.deps.experimentRepository.findOpenByProjectId(projectId);
    for (const experiment of open) {
      if (run.runAt <= experiment.actionAt) continue;
      const outcome = run.outcomes.find((o) => o.query === experiment.query);
      if (!outcome) continue;

      // Resolve on both axes: the mention slot and the citation reading from
      // this (post-action) run. groundingMode gates whether citation is even
      // comparable — a parametric re-measure resolves the slot but leaves
      // citation NA (see classifyCitationMovement).
      experiment.resolve(
        dominantSlot(outcome.slots),
        run.runAt,
        run.groundingMode === "web_grounded",
        outcome.citedSamples > 0
      );
      await this.deps.experimentRepository.save(experiment);
    }
  }
}
