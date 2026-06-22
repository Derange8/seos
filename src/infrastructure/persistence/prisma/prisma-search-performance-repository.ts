import type { PrismaClient } from "@/generated/prisma/client";
import type { SearchPerformanceRepositoryPort } from "@/application/tracking/ports/search-performance-repository-port";
import { SearchPerformanceSnapshot } from "@/domain/tracking/entities/search-performance-snapshot";

export class PrismaSearchPerformanceRepository implements SearchPerformanceRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async saveMany(snapshots: readonly SearchPerformanceSnapshot[]): Promise<void> {
    for (const snapshot of snapshots) {
      const data = {
        clicks: snapshot.clicks,
        impressions: snapshot.impressions,
        ctr: snapshot.ctr,
        position: snapshot.position,
        fetchedAt: new Date(),
      };
      await this.client.searchPerformanceSnapshot.upsert({
        where: { projectId_date: { projectId: snapshot.projectId, date: snapshot.date } },
        create: { id: snapshot.id, projectId: snapshot.projectId, date: snapshot.date, ...data },
        update: data,
      });
    }
  }

  async findByProjectId(projectId: string, limit = 30): Promise<SearchPerformanceSnapshot[]> {
    const rows = await this.client.searchPerformanceSnapshot.findMany({
      where: { projectId },
      orderBy: { date: "desc" },
      take: limit,
    });

    return rows.map((row) =>
      SearchPerformanceSnapshot.reconstitute({
        id: row.id,
        projectId: row.projectId,
        date: row.date,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })
    );
  }

  async findLatestFetchedAt(projectId: string): Promise<Date | null> {
    const row = await this.client.searchPerformanceSnapshot.findFirst({
      where: { projectId },
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    });
    return row?.fetchedAt ?? null;
  }
}
