import { VisibilityExperiment } from "@/domain/ai-visibility/entities/visibility-experiment";
import { dominantSlot } from "@/domain/ai-visibility/slot";
import type { AiVisibilityRunRepositoryPort } from "@/application/ai-visibility/ports/ai-visibility-run-repository-port";
import type { VisibilityExperimentRepositoryPort } from "@/application/ai-visibility/ports/visibility-experiment-repository-port";

export interface StartVisibilityExperimentDeps {
  runRepository: AiVisibilityRunRepositoryPort;
  experimentRepository: VisibilityExperimentRepositoryPort;
}

// Opens an experiment when the user acts on a query (drafts citation content),
// capturing the query's current slot as the baseline to measure against later.
// Returns null when there's no baseline to anchor to (no run has measured this
// query yet) — nothing to track. Idempotent: if one is already open for the
// query, returns it rather than opening a duplicate.
export class StartVisibilityExperimentUseCase {
  constructor(private readonly deps: StartVisibilityExperimentDeps) {}

  async execute(projectId: string, query: string): Promise<VisibilityExperiment | null> {
    const run = await this.deps.runRepository.findLatestByProjectId(projectId);
    const outcome = run?.outcomes.find((o) => o.query === query);
    if (!run || !outcome) return null;

    const existing = await this.deps.experimentRepository.findOpenByProjectAndQuery(projectId, query);
    if (existing) return existing;

    // Capture the citation axis at baseline alongside the slot: whether this
    // run was web-grounded (only then is citation observable) and whether the
    // domain was cited for this query. This is what a later web-grounded
    // re-measure compares against to credit a citation win (see Faz 2).
    const experiment = VisibilityExperiment.start(
      projectId,
      query,
      dominantSlot(outcome.slots),
      run.runAt,
      run.groundingMode === "web_grounded",
      outcome.citedSamples > 0
    );
    await this.deps.experimentRepository.save(experiment);
    return experiment;
  }
}
