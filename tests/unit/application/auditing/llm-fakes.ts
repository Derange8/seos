import type { AuditIssueRecommendationContext, LLMPort } from "@/application/auditing/ports/llm-port";

export class FakeLLMProvider implements LLMPort {
  readonly calls: AuditIssueRecommendationContext[][] = [];
  // Keyed by issueId — set to omit an issue from the returned map (simulates
  // a provider that dropped/failed on just that one).
  responses = new Map<string, string>();

  async generateRecommendations(
    issues: readonly AuditIssueRecommendationContext[]
  ): Promise<Map<string, string>> {
    this.calls.push([...issues]);
    const result = new Map<string, string>();
    for (const issue of issues) {
      const response = this.responses.get(issue.issueId);
      if (response) result.set(issue.issueId, response);
    }
    return result;
  }
}
