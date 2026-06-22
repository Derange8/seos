import type { AuditRunRepositoryPort } from "@/application/auditing/ports/audit-run-repository-port";
import type { LLMPort } from "@/application/auditing/ports/llm-port";

export interface GenerateAuditRecommendationsDeps {
  auditRunRepository: AuditRunRepositoryPort;
  llm: LLMPort;
}

// Only reachable from the recommendation queue, where auditRunId is
// guaranteed to reference a real, already-saved AuditRun by construction —
// a missing one here is a genuine invariant violation, not a recoverable
// outcome, so this throws rather than returning a Result (same reasoning
// as the other AuditRunCompleted/CrawlJobCompleted reaction use cases).
export class GenerateAuditRecommendationsUseCase {
  constructor(private readonly deps: GenerateAuditRecommendationsDeps) {}

  async execute(auditRunId: string): Promise<void> {
    const auditRun = await this.deps.auditRunRepository.findById(auditRunId);
    if (!auditRun) {
      throw new Error(`AuditRun "${auditRunId}" not found while generating recommendations`);
    }

    // Idempotent against re-runs (e.g. a retried queue job after a partial
    // provider failure) — only issues still missing a recommendation are
    // sent, so an already-enriched issue is never overwritten or re-billed.
    const unrecommended = auditRun.issues.filter((issue) => issue.recommendation === null);
    if (unrecommended.length === 0) return;

    const recommendations = await this.deps.llm.generateRecommendations(
      unrecommended.map((issue) => ({
        issueId: issue.id,
        ruleId: issue.ruleId,
        category: issue.category,
        severity: issue.severity,
        message: issue.message,
      }))
    );

    for (const issue of unrecommended) {
      const recommendation = recommendations.get(issue.id);
      if (recommendation) {
        issue.setRecommendation(recommendation);
      }
    }

    await this.deps.auditRunRepository.save(auditRun);
  }
}
