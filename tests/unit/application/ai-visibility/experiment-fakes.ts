import type { VisibilityExperimentRepositoryPort } from "@/application/ai-visibility/ports/visibility-experiment-repository-port";
import type { VisibilityExperiment } from "@/domain/ai-visibility/entities/visibility-experiment";

export class FakeExperimentRepository implements VisibilityExperimentRepositoryPort {
  readonly saved: VisibilityExperiment[] = [];

  async save(experiment: VisibilityExperiment): Promise<void> {
    const i = this.saved.findIndex((e) => e.id === experiment.id);
    if (i >= 0) this.saved[i] = experiment;
    else this.saved.push(experiment);
  }
  async findByProjectId(projectId: string): Promise<VisibilityExperiment[]> {
    return this.saved.filter((e) => e.projectId === projectId);
  }
  async findOpenByProjectId(projectId: string): Promise<VisibilityExperiment[]> {
    return this.saved.filter((e) => e.projectId === projectId && e.status === "OPEN");
  }
  async findOpenByProjectAndQuery(projectId: string, query: string): Promise<VisibilityExperiment | null> {
    return this.saved.find((e) => e.projectId === projectId && e.query === query && e.status === "OPEN") ?? null;
  }
}
