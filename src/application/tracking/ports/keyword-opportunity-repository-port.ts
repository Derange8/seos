import type { KeywordOpportunity } from "@/domain/tracking/entities/keyword-opportunity";

export interface KeywordOpportunityRepositoryPort {
  // Upserts each row on (projectId, pageUrl, query) — re-fetching an
  // already-stored pair overwrites it rather than duplicating, same
  // reasoning as SearchPerformanceRepositoryPort.saveMany.
  saveMany(opportunities: readonly KeywordOpportunity[]): Promise<void>;
  findByProjectId(projectId: string, limit?: number): Promise<KeywordOpportunity[]>;
  findById(id: string): Promise<KeywordOpportunity | null>;
}
