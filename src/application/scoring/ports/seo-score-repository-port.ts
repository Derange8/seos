import type { SeoScore } from "@/domain/scoring/entities/seo-score";

export interface SeoScoreRepositoryPort {
  saveMany(scores: readonly SeoScore[]): Promise<void>;
  findByCrawlJobId(crawlJobId: string): Promise<SeoScore[]>;
}
