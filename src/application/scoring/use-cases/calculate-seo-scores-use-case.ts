import { calculateSeoScores } from "@/domain/scoring/services/seo-score-calculator";
import type { SeoScore } from "@/domain/scoring/entities/seo-score";
import type { SeoScoreRepositoryPort } from "@/application/scoring/ports/seo-score-repository-port";
import type { AuditRunRepositoryPort } from "@/application/auditing/ports/audit-run-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";

export interface CalculateSeoScoresDeps {
  auditRunRepository: AuditRunRepositoryPort;
  pageRepository: PageRepositoryPort;
  seoScoreRepository: SeoScoreRepositoryPort;
}

// Only reachable from AuditRunCompleted, where auditRunId is guaranteed to
// reference a just-saved AuditRun by construction — a missing one here is
// a genuine invariant violation, not a recoverable outcome (same reasoning
// as GenerateSchemaMarkupUseCase's missing-project case), so this throws
// rather than returning a Result.
export class CalculateSeoScoresUseCase {
  constructor(private readonly deps: CalculateSeoScoresDeps) {}

  async execute(auditRunId: string): Promise<SeoScore[]> {
    const auditRun = await this.deps.auditRunRepository.findById(auditRunId);
    if (!auditRun) {
      throw new Error(`AuditRun "${auditRunId}" not found while calculating SEO scores`);
    }

    const pages = await this.deps.pageRepository.findAllByCrawlJobId(auditRun.crawlJobId);
    const scores = calculateSeoScores(auditRunId, auditRun.issues, pages.map((page) => page.id));

    await this.deps.seoScoreRepository.saveMany(scores);
    return scores;
  }
}
