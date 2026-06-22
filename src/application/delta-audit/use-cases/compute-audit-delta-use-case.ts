import { computeAuditDelta, type AuditDelta } from "@/domain/delta-audit/services/delta-audit-calculator";
import type { AuditRunRepositoryPort } from "@/application/auditing/ports/audit-run-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";

export interface ComputeAuditDeltaDeps {
  auditRunRepository: AuditRunRepositoryPort;
  pageRepository: PageRepositoryPort;
}

// Returns null when there aren't yet two finished audit runs to compare —
// a project's very first crawl has nothing to verify against, and that's
// a normal state, not an error.
export class ComputeAuditDeltaUseCase {
  constructor(private readonly deps: ComputeAuditDeltaDeps) {}

  async execute(projectId: string): Promise<AuditDelta | null> {
    const recentRuns = await this.deps.auditRunRepository.findRecentByProjectId(projectId, 2);
    if (recentRuns.length < 2) return null;

    const [current, previous] = recentRuns;
    if (!current || !previous) return null;

    const [previousPages, currentPages] = await Promise.all([
      this.deps.pageRepository.findAllByCrawlJobId(previous.crawlJobId),
      this.deps.pageRepository.findAllByCrawlJobId(current.crawlJobId),
    ]);

    const pageUrlsByPageId = new Map<string, string>();
    for (const page of previousPages) pageUrlsByPageId.set(page.id, page.url.href);
    for (const page of currentPages) pageUrlsByPageId.set(page.id, page.url.href);

    return computeAuditDelta(
      { runId: previous.id, overallScore: previous.overallScore, issues: previous.issues },
      { runId: current.id, overallScore: current.overallScore, issues: current.issues },
      pageUrlsByPageId
    );
  }
}
