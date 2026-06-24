import type {
  PageContentDraftContext,
  PageContentDraftPort,
  PageContentDraftResult,
} from "@/application/content-enrichment/ports/page-content-draft-port";
import {
  PAGE_CONTENT_DRAFT_SYSTEM_PROMPT,
  parsePageContentDraftResult,
} from "@/infrastructure/llm/page-content-draft-prompt";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

interface OpenAiPageContentDraftProviderOptions {
  apiKey: string;
  model?: string;
  // DeepSeek's API is OpenAI-Chat-Completions-compatible — same reuse
  // reasoning as the other OpenAI-shaped providers in this codebase.
  baseUrl?: string;
}

export class OpenAiPageContentDraftProvider implements PageContentDraftPort {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiUrl: string;

  constructor(options: OpenAiPageContentDraftProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
    this.apiUrl = options.baseUrl ?? OPENAI_API_URL;
  }

  async generateDraft(context: PageContentDraftContext): Promise<PageContentDraftResult> {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: PAGE_CONTENT_DRAFT_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(context) },
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
    const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message
      ?.content;
    if (typeof content !== "string") {
      throw new Error("LLM response did not contain message content");
    }
    return parsePageContentDraftResult(content);
  }
}
