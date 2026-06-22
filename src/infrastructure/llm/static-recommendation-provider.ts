import type { AuditIssueRecommendationContext, LLMPort } from "@/application/auditing/ports/llm-port";

// Placeholder LLMPort implementation — deterministic, free, no network
// call. Stands in for a real OpenAI-compatible provider until one is
// configured (see architecture decision #3); every other piece of the
// recommendation pipeline (use case, queue) is already wired against the
// LLMPort interface, so swapping this out later is a one-line change in
// crawl-pipeline.ts's createLlmProvider(), nothing else.
const RULE_RECOMMENDATIONS: Record<string, string> = {
  "missing-title": "Add a concise, descriptive <title> tag that summarizes the page's content.",
  "title-length": "Rewrite the title to fall within the recommended 30-60 character range.",
  "missing-meta-description": "Add a meta description summarizing the page in 1-2 sentences.",
  "meta-description-length": "Rewrite the meta description to fall within the recommended length range.",
  "missing-h1": "Add a single, descriptive <h1> heading that matches the page's main topic.",
  "thin-content": "Expand the page's content — aim for at least a few hundred words of substantive text.",
  "broken-status-code": "Fix the broken response (redirect, restore, or remove links pointing to it).",
  "missing-canonical": "Add a <link rel=\"canonical\"> tag pointing at the preferred URL for this content.",
};

export class StaticRecommendationProvider implements LLMPort {
  async generateRecommendations(
    issues: readonly AuditIssueRecommendationContext[]
  ): Promise<Map<string, string>> {
    const recommendations = new Map<string, string>();
    for (const issue of issues) {
      recommendations.set(issue.issueId, RULE_RECOMMENDATIONS[issue.ruleId] ?? `Review and resolve: ${issue.message}`);
    }
    return recommendations;
  }
}
