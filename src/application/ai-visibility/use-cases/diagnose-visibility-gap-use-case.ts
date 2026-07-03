import type { AiVisibilityModelPort } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { AiVisibilityRunRepositoryPort } from "@/application/ai-visibility/ports/ai-visibility-run-repository-port";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";

export interface DiagnoseVisibilityGapDeps {
  projectRepository: ProjectRepositoryPort;
  runRepository: AiVisibilityRunRepositoryPort;
  model: AiVisibilityModelPort;
}

// "Close the loop" step 1: for a query the business isn't winning, ask the
// model what concrete gaps it would need closed to start recommending the
// business. Grounds the diagnosis in the competitors the latest probe run
// actually saw win that query. Only reachable with a valid projectId (route
// guards it), so a missing project is a real invariant violation — no Result.
export class DiagnoseVisibilityGapUseCase {
  constructor(private readonly deps: DiagnoseVisibilityGapDeps) {}

  async execute(projectId: string, query: string): Promise<string[]> {
    const project = await this.deps.projectRepository.findById(projectId);
    if (!project) throw new Error(`Project "${projectId}" not found`);

    const run = await this.deps.runRepository.findLatestByProjectId(projectId);
    const outcome = run?.outcomes.find((o) => o.query === query);
    const competitors = outcome ? [...outcome.competitorsMentioned] : [];

    return this.deps.model.diagnoseVisibilityGap({
      query,
      brand: project.name,
      domain: project.domain.value,
      competitors,
    });
  }
}
