import { AuditRun } from "@/domain/auditing/entities/audit-run";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { DEFAULT_AUDIT_RULES } from "@/domain/auditing/services/rules";
import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditRunRepositoryPort } from "@/application/auditing/ports/audit-run-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import type { DomainEventDispatcher } from "@/shared/domain-event-dispatcher";

export interface RunAuditDeps {
  pageRepository: PageRepositoryPort;
  auditRunRepository: AuditRunRepositoryPort;
  // Defaults to the full plugin registry — overridable for tests, or for a
  // future "only run these categories" use case.
  rules?: readonly AuditRule[];
  // Optional, like FinalizeCrawlJobIfDoneUseCase's — tests and call sites
  // that don't care about AuditRunCompleted (e.g. the score calculator's
  // own reaction to it) can omit it entirely.
  eventDispatcher?: DomainEventDispatcher;
}

// No expected-failure branch here (unlike StartCrawlUseCase's config/
// verification checks) — any (projectId, crawlJobId) pair just produces an
// AuditRun, even a degenerate one with zero pages and a perfect score. So
// this returns the AuditRun directly rather than a Result.
export class RunAuditUseCase {
  private readonly rules: readonly AuditRule[];

  constructor(private readonly deps: RunAuditDeps) {
    this.rules = deps.rules ?? DEFAULT_AUDIT_RULES;
  }

  async execute(projectId: string, crawlJobId: string): Promise<AuditRun> {
    const pages = await this.deps.pageRepository.findAllByCrawlJobId(crawlJobId);

    const auditRun = AuditRun.create(projectId, crawlJobId);
    for (const page of pages) {
      for (const rule of this.rules) {
        if (page.isBroken() && !rule.appliesToFailedPages) continue;
        for (const finding of rule.evaluate(page)) {
          auditRun.addIssue(AuditIssue.create(auditRun.id, page.id, finding));
        }
      }
    }

    auditRun.finish(pages.length);
    await this.deps.auditRunRepository.save(auditRun);

    if (this.deps.eventDispatcher) {
      await this.deps.eventDispatcher.dispatch(auditRun.pullDomainEvents());
    }

    return auditRun;
  }
}
