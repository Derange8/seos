import type { SearchPerformanceSnapshot } from "@/domain/tracking/entities/search-performance-snapshot";

export interface SearchPerformanceRepositoryPort {
  // Upserts each row on (projectId, date) — re-fetching an already-stored
  // day overwrites it rather than duplicating, since Search Console
  // itself revises recent days' numbers as data settles.
  saveMany(snapshots: readonly SearchPerformanceSnapshot[]): Promise<void>;
  findByProjectId(projectId: string, limit?: number): Promise<SearchPerformanceSnapshot[]>;
  // DB-backed "when did we last actually pull data" signal for the
  // auto-refresh scheduler — survives app restarts, unlike an in-memory
  // timestamp, so a daily cadence is still honored across separate runs
  // of the app rather than re-fetching every time it's opened.
  findLatestFetchedAt(projectId: string): Promise<Date | null>;
}
