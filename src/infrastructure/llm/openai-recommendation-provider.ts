import type { AuditIssueRecommendationContext, LLMPort } from "@/application/auditing/ports/llm-port";
import { parseJsonFromLlm } from "@/infrastructure/llm/llm-json";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "You are an SEO expert. For each audit issue provided, write one concise, " +
  "specific, actionable recommendation (1-2 sentences) explaining exactly " +
  "what to do to fix it. Respond ONLY with a JSON object whose keys are " +
  "the issueId values from the input and whose values are the " +
  "recommendation strings — no other text, no markdown.";

interface OpenAiRecommendationProviderOptions {
  apiKey: string;
  model?: string;
  // DeepSeek's API is OpenAI-Chat-Completions-compatible — same request/
  // response shape, different host and default model — so it reuses this
  // class entirely rather than needing its own implementation.
  baseUrl?: string;
}

// Real LLMPort implementation — one batched chat completion per AuditRun
// (architecture decision #3), same contract StaticRecommendationProvider
// already implements, so this is a drop-in swap with nothing else in the
// pipeline changing. Network/API failures are allowed to throw rather than
// being swallowed here — the in-process recommendation queue (see
// crawl-pipeline.ts) catches and logs it, leaving the AuditRun's
// recommendations un-enriched rather than crashing the process.
export class OpenAiRecommendationProvider implements LLMPort {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiUrl: string;

  constructor(options: OpenAiRecommendationProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
    this.apiUrl = options.baseUrl ?? OPENAI_API_URL;
  }

  async generateRecommendations(
    issues: readonly AuditIssueRecommendationContext[]
  ): Promise<Map<string, string>> {
    if (issues.length === 0) return new Map();

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(issues.map(this.toPromptIssue)) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
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
    const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message
      ?.content;
    if (typeof content !== "string") {
      throw new Error("LLM response did not contain message content");
    }
    return content;
  }

  private parseRecommendations(content: string): Map<string, string> {
    const parsed = parseJsonFromLlm(content);

    const recommendations = new Map<string, string>();
    if (parsed && typeof parsed === "object") {
      for (const [issueId, value] of Object.entries(parsed as Record<string, unknown>)) {
        // An unexpected non-string value for one issue isn't worth failing
        // the whole batch over — that issue just stays unrecommended, same
        // as if the model had omitted it entirely.
        if (typeof value === "string") recommendations.set(issueId, value);
      }
    }
    return recommendations;
  }
}
