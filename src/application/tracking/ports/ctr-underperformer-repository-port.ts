import type { CtrUnderperformer } from "@/domain/tracking/entities/ctr-underperformer";

export interface CtrUnderperformerRepositoryPort {
  // Deletes every existing issue for this project and inserts the fresh
  // set — same reasoning as KeywordCannibalizationRepositoryPort: a query
  // that's no longer underperforming needs to disappear, not linger.
  replaceForProject(projectId: string, issues: readonly CtrUnderperformer[]): Promise<void>;
  findByProjectId(projectId: string): Promise<CtrUnderperformer[]>;
}
