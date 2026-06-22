import type { AuditRunRepositoryPort } from "@/application/auditing/ports/audit-run-repository-port";
import type { AuditRun } from "@/domain/auditing/entities/audit-run";

export class FakeAuditRunRepository implements AuditRunRepositoryPort {
  readonly saved: AuditRun[] = [];
  private readonly byId = new Map<string, AuditRun>();

  async save(auditRun: AuditRun): Promise<void> {
    this.byId.set(auditRun.id, auditRun);
    this.saved.push(auditRun);
  }

  async findById(id: string): Promise<AuditRun | null> {
    return this.byId.get(id) ?? null;
  }

  async findByCrawlJobId(crawlJobId: string): Promise<AuditRun | null> {
    const matches = [...this.byId.values()].filter((run) => run.crawlJobId === crawlJobId);
    return matches.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0] ?? null;
  }

  async findRecentByProjectId(projectId: string, limit: number): Promise<AuditRun[]> {
    const matches = [...this.byId.values()].filter(
      (run) => run.projectId === projectId && run.isFinished
    );
    return matches
      .sort((a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0))
      .slice(0, limit);
  }
}
