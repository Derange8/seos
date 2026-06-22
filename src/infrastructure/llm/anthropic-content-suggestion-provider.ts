import type { ContentEnrichmentContext, ContentEnrichmentPort } from "@/application/content-enrichment/ports/content-enrichment-port";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-3-5-haiku-latest";
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT =
  "You are an SEO content strategist. You'll be given a page that already " +
  "ranks on Google for a specific search query, but not yet on page 1. " +
  "Write a concrete, specific paragraph (3-5 sentences) describing what " +
  "content to add or expand on that page to better satisfy the query's " +
  "search intent and improve its ranking. Be specific to the query topic " +
  "— do not give generic SEO advice like 'add more keywords'. Respond with " +
  "ONLY the suggestion text, no preamble, no markdown, no headings.";

interface AnthropicContentSuggestionProviderOptions {
  apiKey: string;
  model?: string;
}

export class AnthropicContentSuggestionProvider implements ContentEnrichmentPort {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: AnthropicContentSuggestionProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
  }

  async generateSuggestion(context: ContentEnrichmentContext): Promise<string> {
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
        messages: [{ role: "user", content: JSON.stringify(context) }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`LLM request failed (${response.status}): ${body}`);
    }

    const data: unknown = await response.json();
    const blocks = (data as { content?: { type?: string; text?: unknown }[] })?.content;
    const text = blocks?.find((block) => block.type === "text")?.text;
    if (typeof text !== "string") {
      throw new Error("LLM response did not contain message content");
    }
    return text.trim();
  }
}
