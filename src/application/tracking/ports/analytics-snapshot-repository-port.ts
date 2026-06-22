import type { AnalyticsSnapshot } from "@/domain/tracking/entities/analytics-snapshot";

export interface AnalyticsSnapshotRepositoryPort {
  saveMany(snapshots: readonly AnalyticsSnapshot[]): Promise<void>;
  findByProjectId(projectId: string, limit?: number): Promise<AnalyticsSnapshot[]>;
}
