import type {
  ContentIdeaPageContext,
  ContentIdeaPort,
  ContentIdeaSuggestion,
} from "@/application/content-enrichment/ports/content-idea-port";
import { parseContentIdeaSuggestions } from "@/infrastructure/llm/openai-content-idea-provider";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-3-5-haiku-latest";
const MAX_TOKENS = 4096;

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
  "rationale. Respond ONLY with a JSON array of objects shaped like " +
  '{"pageUrl": ..., "topic": ..., "suggestedTitle": ..., "suggestedSlug": ..., "rationale": ...} ' +
  "— no other text, no markdown, no code fences.";

interface AnthropicContentIdeaProviderOptions {
  apiKey: string;
  model?: string;
}

// Same ContentIdeaPort contract as OpenAiContentIdeaProvider, against
// Anthropic's Messages API instead — different request/response envelope
// (see AnthropicRecommendationProvider for the same distinction), but
// shares the same JSON-array parsing logic once the raw text is extracted.
export class AnthropicContentIdeaProvider implements ContentIdeaPort {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: AnthropicContentIdeaProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
  }

  async generateContentIdeas(pages: readonly ContentIdeaPageContext[]): Promise<ContentIdeaSuggestion[]> {
    if (pages.length === 0) return [];

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
        messages: [{ role: "user", content: JSON.stringify(pages) }],
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
    const blocks = (data as { content?: { type?: string; text?: unknown }[] })?.content;
    const text = blocks?.find((block) => block.type === "text")?.text;
    if (typeof text !== "string") {
      throw new Error("LLM response did not contain message content");
    }
    return text;
  }
}
