import type { ContentEnrichmentContext, ContentEnrichmentPort } from "@/application/content-enrichment/ports/content-enrichment-port";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "You are an SEO content strategist. You'll be given a page that already " +
  "ranks on Google for a specific search query, but not yet on page 1. " +
  "Write a concrete, specific paragraph (3-5 sentences) describing what " +
  "content to add or expand on that page to better satisfy the query's " +
  "search intent and improve its ranking. Be specific to the query topic " +
  "— do not give generic SEO advice like 'add more keywords'. Respond with " +
  "ONLY the suggestion text, no preamble, no markdown, no headings.";

interface OpenAiContentSuggestionProviderOptions {
  apiKey: string;
  model?: string;
  // DeepSeek's API is OpenAI-Chat-Completions-compatible — same reuse
  // reasoning as OpenAiRecommendationProvider.
  baseUrl?: string;
}

export class OpenAiContentSuggestionProvider implements ContentEnrichmentPort {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiUrl: string;

  constructor(options: OpenAiContentSuggestionProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
    this.apiUrl = options.baseUrl ?? OPENAI_API_URL;
  }

  async generateSuggestion(context: ContentEnrichmentContext): Promise<string> {
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
          { role: "user", content: JSON.stringify(context) },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`LLM request failed (${response.status}): ${body}`);
    }

    const data: unknown = await response.json();
    const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message
      ?.content;
    if (typeof content !== "string") {
      throw new Error("LLM response did not contain message content");
    }
    return content.trim();
  }
}
