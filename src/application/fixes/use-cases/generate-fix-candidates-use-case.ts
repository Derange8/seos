import { generateFixCandidates } from "@/domain/fixes/services/fix-engine";
import type { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import type { FixCandidateRepositoryPort } from "@/application/fixes/ports/fix-candidate-repository-port";
import type { AuditRunRepositoryPort } from "@/application/auditing/ports/audit-run-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import type { KeywordOpportunityRepositoryPort } from "@/application/tracking/ports/keyword-opportunity-repository-port";

export interface GenerateFixCandidatesDeps {
  auditRunRepository: AuditRunRepositoryPort;
  pageRepository: PageRepositoryPort;
  fixCandidateRepository: FixCandidateRepositoryPort;
  // Optional — omitting it (e.g. in tests, or before a Google connection
  // exists) just means generators fall back to their template logic, same
  // as generateFixCandidates' own default.
  keywordOpportunityRepository?: KeywordOpportunityRepositoryPort;
}

// Only reachable from AuditRunCompleted, where auditRunId is guaranteed to
// reference a just-saved AuditRun by construction — a missing one here is
// a genuine invariant violation, not a recoverable outcome (same reasoning
// as CalculateSeoScoresUseCase), so this throws rather than returning a
// Result.
export class GenerateFixCandidatesUseCase {
  constructor(private readonly deps: GenerateFixCandidatesDeps) {}

  async execute(auditRunId: string): Promise<FixCandidate[]> {
    const auditRun = await this.deps.auditRunRepository.findById(auditRunId);
    if (!auditRun) {
      throw new Error(`AuditRun "${auditRunId}" not found while generating fix candidates`);
    }

    const pages = await this.deps.pageRepository.findAllByCrawlJobId(auditRun.crawlJobId);
    const pagesById = new Map(pages.map((page) => [page.id, page]));
    const keywordOpportunities = this.deps.keywordOpportunityRepository
      ? await this.deps.keywordOpportunityRepository.findByProjectId(auditRun.projectId)
      : [];

    const candidates = generateFixCandidates(auditRun.issues, pagesById, undefined, keywordOpportunities);

    await this.deps.fixCandidateRepository.saveMany(candidates);
    return candidates;
  }
}
