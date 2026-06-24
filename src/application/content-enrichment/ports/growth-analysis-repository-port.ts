import type { GrowthAnalysis } from "@/domain/content-enrichment/entities/growth-analysis";

export interface GrowthAnalysisRepositoryPort {
  // One row per project — a regeneration overwrites whatever was there
  // before rather than accumulating history.
  save(analysis: GrowthAnalysis): Promise<void>;
  findByProjectId(projectId: string): Promise<GrowthAnalysis | null>;
}
