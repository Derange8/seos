import type { PrismaClient } from "@/generated/prisma/client";
import type { AnalyticsSnapshotRepositoryPort } from "@/application/tracking/ports/analytics-snapshot-repository-port";
import { AnalyticsSnapshot } from "@/domain/tracking/entities/analytics-snapshot";

export class PrismaAnalyticsSnapshotRepository implements AnalyticsSnapshotRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async saveMany(snapshots: readonly AnalyticsSnapshot[]): Promise<void> {
    for (const snapshot of snapshots) {
      const data = {
        organicSessions: snapshot.organicSessions,
        conversions: snapshot.conversions,
        fetchedAt: new Date(),
      };
      await this.client.analyticsSnapshot.upsert({
        where: { projectId_date: { projectId: snapshot.projectId, date: snapshot.date } },
        create: { id: snapshot.id, projectId: snapshot.projectId, date: snapshot.date, ...data },
        update: data,
      });
    }
  }

  async findByProjectId(projectId: string, limit = 30): Promise<AnalyticsSnapshot[]> {
    const rows = await this.client.analyticsSnapshot.findMany({
      where: { projectId },
      orderBy: { date: "desc" },
      take: limit,
    });

    return rows.map((row) =>
      AnalyticsSnapshot.reconstitute({
        id: row.id,
        projectId: row.projectId,
        date: row.date,
        organicSessions: row.organicSessions,
        conversions: row.conversions,
      })
    );
  }
}
