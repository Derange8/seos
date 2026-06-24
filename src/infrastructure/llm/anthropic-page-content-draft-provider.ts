import type {
  PageContentDraftContext,
  PageContentDraftPort,
  PageContentDraftResult,
} from "@/application/content-enrichment/ports/page-content-draft-port";
import {
  PAGE_CONTENT_DRAFT_SYSTEM_PROMPT,
  parsePageContentDraftResult,
} from "@/infrastructure/llm/page-content-draft-prompt";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-3-5-haiku-latest";
const MAX_TOKENS = 4096;

interface AnthropicPageContentDraftProviderOptions {
  apiKey: string;
  model?: string;
}

export class AnthropicPageContentDraftProvider implements PageContentDraftPort {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: AnthropicPageContentDraftProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
  }

  async generateDraft(context: PageContentDraftContext): Promise<PageContentDraftResult> {
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
        system: PAGE_CONTENT_DRAFT_SYSTEM_PROMPT,
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
    return parsePageContentDraftResult(text);
  }
}
