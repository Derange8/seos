import type {
  ContentIdeaPageContext,
  ContentIdeaPort,
  ContentIdeaSuggestion,
} from "@/application/content-enrichment/ports/content-idea-port";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "You are an SEO content strategist. You'll be given a list of existing pages from a " +
  "website, each with its URL, title, and H1. For each page, identify the underlying " +
  "product or topic, then suggest up to 3 content gap ideas: short, question-style " +
  "article topics (write them in the same language as the page's own title/H1) that " +
  "people commonly ask about that product or topic, which this site does not appear to " +
  "have a dedicated page for yet. These are qualitative content ideas based on common " +
  "question patterns, NOT measured search data — never invent search volume numbers, " +
  "ranking positions, or traffic estimates, and never claim an idea is verified or " +
  "guaranteed to drive traffic. For each idea, suggest a concise article title and a " +
  "URL slug (lowercase, hyphenated, ASCII only, prefixed with /blog/), and a one-sentence " +
  'rationale. Respond ONLY with a JSON object shaped like {"ideas": [{"pageUrl": ..., ' +
  '"topic": ..., "suggestedTitle": ..., "suggestedSlug": ..., "rationale": ...}, ...]} ' +
  "— no other text, no markdown, no code fences.";

interface OpenAiContentIdeaProviderOptions {
  apiKey: string;
  model?: string;
  // DeepSeek's API is OpenAI-Chat-Completions-compatible — same reuse
  // reasoning as OpenAiRecommendationProvider.
  baseUrl?: string;
}

export class OpenAiContentIdeaProvider implements ContentIdeaPort {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiUrl: string;

  constructor(options: OpenAiContentIdeaProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
    this.apiUrl = options.baseUrl ?? OPENAI_API_URL;
  }

  async generateContentIdeas(pages: readonly ContentIdeaPageContext[]): Promise<ContentIdeaSuggestion[]> {
    if (pages.length === 0) return [];

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
          { role: "user", content: JSON.stringify(pages) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`LLM request failed (${response.status}): ${body}`);
    }

    const data: unknown = await response.json();
    const content = this.extractContent(data);
    return parseContentIdeaSuggestions(content);
  }

  private extractContent(data: unknown): string {
    const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message
      ?.content;
    if (typeof content !== "string") {
      throw new Error("LLM response did not contain message content");
    }
    return content;
  }
}

// Shared by both OpenAI- and Anthropic-shaped providers — the only real
// difference between them is how the raw text is extracted from their
// respective response envelopes, not how that text is parsed once
// extracted.
export function parseContentIdeaSuggestions(content: string): ContentIdeaSuggestion[] {
  // Some models (and `json_object` mode specifically) wrap a requested
  // array in a top-level object, e.g. {"ideas": [...]}  — and Claude
  // sometimes fences the JSON in markdown despite being told not to.
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error("LLM response content was not valid JSON");
  }

  const candidates = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? Object.values(parsed as Record<string, unknown>).find((value) => Array.isArray(value))
      : undefined;

  if (!Array.isArray(candidates)) return [];

  const suggestions: ContentIdeaSuggestion[] = [];
  for (const entry of candidates) {
    if (!entry || typeof entry !== "object") continue;
    const { pageUrl, topic, suggestedTitle, suggestedSlug, rationale } = entry as Record<string, unknown>;
    // An entry missing any required field isn't worth failing the whole
    // batch over — it's just dropped, same tolerance as the recommendation
    // providers apply to a single bad map entry.
    if (
      typeof pageUrl === "string" &&
      typeof topic === "string" &&
      typeof suggestedTitle === "string" &&
      typeof suggestedSlug === "string" &&
      typeof rationale === "string"
    ) {
      suggestions.push({ pageUrl, topic, suggestedTitle, suggestedSlug, rationale });
    }
  }
  return suggestions;
}
