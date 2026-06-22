import type { AuditCategory, AuditSeverity } from "@/domain/auditing/entities/audit-issue";

export interface AuditIssueRecommendationContext {
  issueId: string;
  ruleId: string;
  category: AuditCategory;
  severity: AuditSeverity;
  // Already contains the affected page's URL (every audit rule's finding
  // message embeds it), so no separate pageUrl field is needed for context.
  message: string;
}

export interface LLMPort {
  // One call per AuditRun (architecture decision #3), not one per issue —
  // batched for cost/latency. Returns recommendation text keyed by issueId;
  // an issue missing from the result (e.g. the provider dropped it, or
  // failed for just that one) simply stays unrecommended until the next run.
  generateRecommendations(
    issues: readonly AuditIssueRecommendationContext[]
  ): Promise<Map<string, string>>;
}
