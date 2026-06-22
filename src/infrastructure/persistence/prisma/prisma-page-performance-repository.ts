import type { PrismaClient } from "@/generated/prisma/client";
import type { PagePerformanceRepositoryPort } from "@/application/tracking/ports/page-performance-repository-port";
import { PagePerformance } from "@/domain/tracking/entities/page-performance";

export class PrismaPagePerformanceRepository implements PagePerformanceRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async saveMany(rows: readonly PagePerformance[]): Promise<void> {
    for (const row of rows) {
      const data = {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        fetchedAt: new Date(),
      };
      await this.client.pagePerformance.upsert({
        where: {
          projectId_pageUrl: {
            projectId: row.projectId,
            pageUrl: row.pageUrl,
          },
        },
        create: {
          id: row.id,
          projectId: row.projectId,
          pageUrl: row.pageUrl,
          ...data,
        },
        update: data,
      });
    }
  }

  async findByProjectId(projectId: string): Promise<PagePerformance[]> {
    const rows = await this.client.pagePerformance.findMany({ where: { projectId } });

    return rows.map((row) =>
      PagePerformance.reconstitute({
        id: row.id,
        projectId: row.projectId,
        pageUrl: row.pageUrl,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })
    );
  }
}
