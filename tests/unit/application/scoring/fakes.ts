import type { SeoScoreRepositoryPort } from "@/application/scoring/ports/seo-score-repository-port";
import type { SeoScore } from "@/domain/scoring/entities/seo-score";

export class FakeSeoScoreRepository implements SeoScoreRepositoryPort {
  readonly saved: SeoScore[] = [];

  async saveMany(scores: readonly SeoScore[]): Promise<void> {
    this.saved.push(...scores);
  }

  async findByCrawlJobId(): Promise<SeoScore[]> {
    // No test currently needs this to be crawlJobId-aware (mirrors
    // FakeSchemaMarkupRepository's same simplification) — every test deals
    // with one crawl job at a time.
    return [...this.saved];
  }
}
