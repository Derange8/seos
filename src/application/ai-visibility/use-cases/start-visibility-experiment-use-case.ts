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

    const experiment = VisibilityExperiment.start(projectId, query, dominantSlot(outcome.slots), run.runAt);
    await this.deps.experimentRepository.save(experiment);
    return experiment;
  }
}
