import type { VisibilityExperiment } from "@/domain/ai-visibility/entities/visibility-experiment";

export interface VisibilityExperimentRepositoryPort {
  save(experiment: VisibilityExperiment): Promise<void>;
  // All experiments for a project, most-recent-action-first — for the ledger UI.
  findByProjectId(projectId: string): Promise<VisibilityExperiment[]>;
  // Still-OPEN experiments — the ones a new probe run can resolve.
  findOpenByProjectId(projectId: string): Promise<VisibilityExperiment[]>;
  // Used to avoid opening a duplicate experiment while one is already tracking
  // the same query.
  findOpenByProjectAndQuery(projectId: string, query: string): Promise<VisibilityExperiment | null>;
}
