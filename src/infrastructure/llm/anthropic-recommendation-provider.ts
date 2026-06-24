import type { AuditIssueRecommendationContext, LLMPort } from "@/application/auditing/ports/llm-port";
import { parseJsonFromLlm } from "@/infrastructure/llm/llm-json";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-3-5-haiku-latest";
const MAX_TOKENS = 2048;

const SYSTEM_PROMPT =
  "You are an SEO expert. For each audit issue provided, write one concise, " +
  "specific, actionable recommendation (1-2 sentences) explaining exactly " +
  "what to do to fix it. Respond ONLY with a JSON object whose keys are " +
  "the issueId values from the input and whose values are the " +
  "recommendation strings — no other text, no markdown, no code fences.";

interface AnthropicRecommendationProviderOptions {
  apiKey: string;
  model?: string;
}

// Same LLMPort contract as OpenAiRecommendationProvider, against
// Anthropic's Messages API instead of Chat Completions — different
// request shape (system is a top-level field, not a message; auth header
// is x-api-key, not Bearer) and response shape (content is an array of
// typed blocks, not choices[0].message.content), so it can't reuse that
// class the way DeepSeek does.
export class AnthropicRecommendationProvider implements LLMPort {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: AnthropicRecommendationProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
  }

  async generateRecommendations(
    issues: readonly AuditIssueRecommendationContext[]
  ): Promise<Map<string, string>> {
    if (issues.length === 0) return new Map();

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(issues.map(this.toPromptIssue)) }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`LLM request failed (${response.status}): ${body}`);
    }

    const data: unknown = await response.json();
    const content = this.extractContent(data);
    return this.parseRecommendations(content);
  }

  private toPromptIssue(issue: AuditIssueRecommendationContext) {
    return {
      issueId: issue.issueId,
      ruleId: issue.ruleId,
      category: issue.category,
      severity: issue.severity,
      message: issue.message,
    };
  }

  private extractContent(data: unknown): string {
    const blocks = (data as { content?: { type?: string; text?: unknown }[] })?.content;
    const text = blocks?.find((block) => block.type === "text")?.text;
    if (typeof text !== "string") {
      throw new Error("LLM response did not contain message content");
    }
    return text;
  }

  private parseRecommendations(content: string): Map<string, string> {
    const parsed = parseJsonFromLlm(content);

    const recommendations = new Map<string, string>();
    if (parsed && typeof parsed === "object") {
      for (const [issueId, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string") recommendations.set(issueId, value);
      }
    }
    return recommendations;
  }
}
