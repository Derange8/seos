import type { PrismaClient, SeoScore as PrismaSeoScoreRow } from "@/generated/prisma/client";
import type { SeoScoreRepositoryPort } from "@/application/scoring/ports/seo-score-repository-port";
import { SeoScore } from "@/domain/scoring/entities/seo-score";
import type { AuditCategory } from "@/domain/auditing/entities/audit-issue";
import { sqliteWriteLock } from "@/shared/async-mutex";

function toDomain(row: PrismaSeoScoreRow): SeoScore {
  return SeoScore.reconstitute({
    id: row.id,
    auditRunId: row.auditRunId,
    pageId: row.pageId,
    category: row.category as AuditCategory,
    score: row.score,
  });
}

export class PrismaSeoScoreRepository implements SeoScoreRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  // Plain inserts, no upsert — every AuditRun produces its own fresh set of
  // scores exactly once (from CalculateSeoScoresUseCase, itself triggered
  // once per AuditRunCompleted), there's nothing to replace.
  async saveMany(scores: readonly SeoScore[]): Promise<void> {
    if (scores.length === 0) return;

    // Same single-connection contention risk as the other writes that run
    // during/right after a concurrent crawl — see AsyncMutex's doc comment.
    await sqliteWriteLock.runExclusive(() =>
      this.client.seoScore.createMany({
        data: scores.map((score) => ({
          id: score.id,
          auditRunId: score.auditRunId,
          pageId: score.pageId,
          category: score.category,
          score: score.score,
        })),
      })
    );
  }

  async findByCrawlJobId(crawlJobId: string): Promise<SeoScore[]> {
    const rows = await this.client.seoScore.findMany({
      where: { auditRun: { crawlJobId } },
    });
    return rows.map(toDomain);
  }
}
