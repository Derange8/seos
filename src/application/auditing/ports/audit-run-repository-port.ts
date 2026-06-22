import type { AuditRun } from "@/domain/auditing/entities/audit-run";

export interface AuditRunRepositoryPort {
  save(auditRun: AuditRun): Promise<void>;
  findById(id: string): Promise<AuditRun | null>;
  // The most recent audit run for a crawl job — callers (e.g. the dashboard)
  // only ever know the crawlJobId, not an AuditRun's own id.
  findByCrawlJobId(crawlJobId: string): Promise<AuditRun | null>;
  // Newest-first, finished runs only (an in-progress run has no settled
  // issues/score to compare). Delta Audit's only consumer: it needs the
  // last two finished runs for a project, not scoped to one crawl job.
  findRecentByProjectId(projectId: string, limit: number): Promise<AuditRun[]>;
}
