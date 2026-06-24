import type { PrismaClient } from "@/generated/prisma/client";
import type { GrowthAnalysisRepositoryPort } from "@/application/content-enrichment/ports/growth-analysis-repository-port";
import {
  GrowthAnalysis,
  isConversionOpportunity,
  isGrowthOpportunity,
  isStringArray,
} from "@/domain/content-enrichment/entities/growth-analysis";

// Same defensive-coercion reasoning as prisma-page-repository.ts's
// toDomainFaqs — these JSON columns aren't shape-checked by SQLite any
// more than the LLM's own output is, so reading them back applies the
// exact same validation the providers apply to raw model output.
function toDomainOpportunities(raw: unknown) {
  return Array.isArray(raw) ? raw.filter(isGrowthOpportunity) : [];
}

function toDomainConversionOpportunities(raw: unknown) {
  return Array.isArray(raw) ? raw.filter(isConversionOpportunity) : [];
}

function toDomainStringArray(raw: unknown): string[] {
  return isStringArray(raw) ? raw : [];
}

export class PrismaGrowthAnalysisRepository implements GrowthAnalysisRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async save(analysis: GrowthAnalysis): Promise<void> {
    await this.client.growthAnalysis.upsert({
      where: { projectId: analysis.projectId },
      create: {
        id: analysis.id,
        projectId: analysis.projectId,
        businessUnderstanding: analysis.businessUnderstanding,
        contentGapsSummary: analysis.contentGapsSummary,
        opportunities: analysis.opportunities as object,
        conversionOpportunities: analysis.conversionOpportunities as object,
        missingCompetitorPages: analysis.missingCompetitorPages as object,
        topPages: analysis.topPages as object,
        executiveSummary: analysis.executiveSummary,
      },
      update: {
        businessUnderstanding: analysis.businessUnderstanding,
        contentGapsSummary: analysis.contentGapsSummary,
        opportunities: analysis.opportunities as object,
        conversionOpportunities: analysis.conversionOpportunities as object,
        missingCompetitorPages: analysis.missingCompetitorPages as object,
        topPages: analysis.topPages as object,
        executiveSummary: analysis.executiveSummary,
        generatedAt: analysis.generatedAt,
      },
    });
  }

  async findByProjectId(projectId: string): Promise<GrowthAnalysis | null> {
    const row = await this.client.growthAnalysis.findUnique({ where: { projectId } });
    if (!row) return null;

    return GrowthAnalysis.reconstitute({
      id: row.id,
      projectId: row.projectId,
      businessUnderstanding: row.businessUnderstanding,
      contentGapsSummary: row.contentGapsSummary,
      opportunities: toDomainOpportunities(row.opportunities),
      conversionOpportunities: toDomainConversionOpportunities(row.conversionOpportunities),
      missingCompetitorPages: toDomainStringArray(row.missingCompetitorPages),
      topPages: toDomainStringArray(row.topPages),
      executiveSummary: row.executiveSummary,
      generatedAt: row.generatedAt,
    });
  }
}
