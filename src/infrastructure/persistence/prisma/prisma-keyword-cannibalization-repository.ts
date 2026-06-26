import type { PrismaClient } from "@/generated/prisma/client";
import type { KeywordCannibalizationRepositoryPort } from "@/application/tracking/ports/keyword-cannibalization-repository-port";
import { KeywordCannibalizationIssue, type CannibalizingPage } from "@/domain/tracking/entities/keyword-cannibalization";

// Same defensive coercion as Page's faqs/redirectChain columns — pages is
// a plain JSON value, not type-checked by the DB.
function toDomainPages(raw: unknown): CannibalizingPage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is CannibalizingPage => {
    const candidate = entry as Record<string, unknown>;
    return (
      typeof candidate === "object" &&
      candidate !== null &&
      typeof candidate.pageUrl === "string" &&
      typeof candidate.clicks === "number" &&
      typeof candidate.impressions === "number" &&
      typeof candidate.ctr === "number" &&
      typeof candidate.position === "number"
    );
  });
}

export class PrismaKeywordCannibalizationRepository implements KeywordCannibalizationRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async replaceForProject(projectId: string, issues: readonly KeywordCannibalizationIssue[]): Promise<void> {
    await this.client.$transaction([
      this.client.keywordCannibalization.deleteMany({ where: { projectId } }),
      this.client.keywordCannibalization.createMany({
        data: issues.map((issue) => ({
          id: issue.id,
          projectId: issue.projectId,
          query: issue.query,
          pages: issue.pages.map((page) => ({ ...page })),
          detectedAt: issue.detectedAt,
        })),
      }),
    ]);
  }

  async findByProjectId(projectId: string): Promise<KeywordCannibalizationIssue[]> {
    const rows = await this.client.keywordCannibalization.findMany({
      where: { projectId },
      orderBy: { detectedAt: "desc" },
    });

    return rows.map((row) =>
      KeywordCannibalizationIssue.reconstitute({
        id: row.id,
        projectId: row.projectId,
        query: row.query,
        pages: toDomainPages(row.pages),
        detectedAt: row.detectedAt,
      })
    );
  }
}
