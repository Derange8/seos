import type { PrismaClient } from "@/generated/prisma/client";
import type { KeywordOpportunityRepositoryPort } from "@/application/tracking/ports/keyword-opportunity-repository-port";
import { KeywordOpportunity } from "@/domain/tracking/entities/keyword-opportunity";

export class PrismaKeywordOpportunityRepository implements KeywordOpportunityRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async saveMany(opportunities: readonly KeywordOpportunity[]): Promise<void> {
    for (const opportunity of opportunities) {
      const data = {
        clicks: opportunity.clicks,
        impressions: opportunity.impressions,
        ctr: opportunity.ctr,
        position: opportunity.position,
        fetchedAt: new Date(),
      };
      await this.client.keywordOpportunity.upsert({
        where: {
          projectId_pageUrl_query: {
            projectId: opportunity.projectId,
            pageUrl: opportunity.pageUrl,
            query: opportunity.query,
          },
        },
        create: {
          id: opportunity.id,
          projectId: opportunity.projectId,
          pageUrl: opportunity.pageUrl,
          query: opportunity.query,
          ...data,
        },
        update: data,
      });
    }
  }

  async findByProjectId(projectId: string, limit = 50): Promise<KeywordOpportunity[]> {
    const rows = await this.client.keywordOpportunity.findMany({
      where: { projectId },
      orderBy: { impressions: "desc" },
      take: limit,
    });

    return rows.map((row) =>
      KeywordOpportunity.reconstitute({
        id: row.id,
        projectId: row.projectId,
        pageUrl: row.pageUrl,
        query: row.query,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })
    );
  }

  async findById(id: string): Promise<KeywordOpportunity | null> {
    const row = await this.client.keywordOpportunity.findUnique({ where: { id } });
    if (!row) return null;

    return KeywordOpportunity.reconstitute({
      id: row.id,
      projectId: row.projectId,
      pageUrl: row.pageUrl,
      query: row.query,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    });
  }
}
