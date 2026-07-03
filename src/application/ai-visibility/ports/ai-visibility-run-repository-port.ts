import type { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";

export interface AiVisibilityRunRepositoryPort {
  // Append-only (like SitemapFile/AuditRun) — every run is kept so the
  // dashboard can show an AI-visibility trend over time.
  save(run: AiVisibilityProbeRun): Promise<void>;
  findLatestByProjectId(projectId: string): Promise<AiVisibilityProbeRun | null>;
}
