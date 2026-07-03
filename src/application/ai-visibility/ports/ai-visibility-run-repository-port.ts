import type { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";

export interface AiVisibilityRunRepositoryPort {
  // Append-only (like SitemapFile/AuditRun) — every run is kept so the
  // dashboard can show an AI-visibility trend over time.
  save(run: AiVisibilityProbeRun): Promise<void>;
  findLatestByProjectId(projectId: string): Promise<AiVisibilityProbeRun | null>;
  // Most-recent-first, capped at `limit` — used to compare the latest run
  // against the previous one for the re-measure delta.
  findRecentByProjectId(projectId: string, limit: number): Promise<AiVisibilityProbeRun[]>;
}
