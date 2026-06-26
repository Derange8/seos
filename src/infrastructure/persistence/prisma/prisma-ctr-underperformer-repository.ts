import type { PrismaClient } from "@/generated/prisma/client";
import type { CtrUnderperformerRepositoryPort } from "@/application/tracking/ports/ctr-underperformer-repository-port";
import { CtrUnderperformer } from "@/domain/tracking/entities/ctr-underperformer";

export class PrismaCtrUnderperformerRepository implements CtrUnderperformerRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async replaceForProject(projectId: string, issues: readonly CtrUnderperformer[]): Promise<void> {
    await this.client.$transaction([
      this.client.ctrUnderperformer.deleteMany({ where: { projectId } }),
      this.client.ctrUnderperformer.createMany({
        data: issues.map((issue) => ({
          id: issue.id,
          projectId: issue.projectId,
          pageUrl: issue.pageUrl,
          query: issue.query,
          position: issue.position,
          ctr: issue.ctr,
          expectedCtr: issue.expectedCtr,
          clicks: issue.clicks,
          impressions: issue.impressions,
          detectedAt: issue.detectedAt,
        })),
      }),
    ]);
  }

  async findByProjectId(projectId: string): Promise<CtrUnderperformer[]> {
    const rows = await this.client.ctrUnderperformer.findMany({
      where: { projectId },
      orderBy: { impressions: "desc" },
    });

    return rows.map((row) =>
      CtrUnderperformer.reconstitute({
        id: row.id,
        projectId: row.projectId,
        pageUrl: row.pageUrl,
        query: row.query,
        position: row.position,
        ctr: row.ctr,
        expectedCtr: row.expectedCtr,
        clicks: row.clicks,
        impressions: row.impressions,
        detectedAt: row.detectedAt,
      })
    );
  }
}
