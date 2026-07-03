import type {
  AiVisibilityModelPort,
  CitationDraft,
} from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";

export interface GenerateCitationContentDeps {
  projectRepository: ProjectRepositoryPort;
  model: AiVisibilityModelPort;
}

// "Close the loop" step 2 (act): draft a citation-optimized page for a query
// the business wants to win, guided by the diagnosis gaps the caller already
// obtained. Not persisted — it's a copyable draft (same on-demand shape as
// the diagnosis itself). Only reachable with a valid projectId (route guards
// it), so a missing project is a real invariant violation — no Result.
export class GenerateCitationContentUseCase {
  constructor(private readonly deps: GenerateCitationContentDeps) {}

  async execute(projectId: string, query: string, gaps: string[]): Promise<CitationDraft> {
    const project = await this.deps.projectRepository.findById(projectId);
    if (!project) throw new Error(`Project "${projectId}" not found`);

    return this.deps.model.generateCitationContent({
      query,
      brand: project.name,
      domain: project.domain.value,
      gaps,
    });
  }
}
