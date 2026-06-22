import type { PagePerformance } from "@/domain/tracking/entities/page-performance";

export interface PagePerformanceRepositoryPort {
  // Upserts each row on (projectId, pageUrl) — re-fetching an already-stored
  // page overwrites it rather than duplicating, same reasoning as
  // KeywordOpportunityRepositoryPort.saveMany.
  saveMany(rows: readonly PagePerformance[]): Promise<void>;
  findByProjectId(projectId: string): Promise<PagePerformance[]>;
}
