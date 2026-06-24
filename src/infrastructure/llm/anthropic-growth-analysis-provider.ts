import type {
  GrowthAnalysisPageContext,
  GrowthAnalysisPort,
  GrowthAnalysisResult,
} from "@/application/content-enrichment/ports/growth-analysis-port";
import { parseGrowthAnalysisResult } from "@/infrastructure/llm/openai-growth-analysis-provider";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-3-5-haiku-latest";
const MAX_TOKENS = 8192;

const SYSTEM_PROMPT =
  "You are an SEO Growth Analyst. Your job is NOT a technical SEO audit (title length, meta " +
  "tags, schema markup, etc.) — focus entirely on business growth opportunities: content " +
  "gaps, missing pages, conversion weaknesses, and what a customer would search before " +
  "purchasing. You'll be given every crawled page of a website: its URL, title, H1, a content " +
  "excerpt, and how many FAQ entries were detected on it.\n\n" +
  "Hard rules:\n" +
  "- Never invent search volume, ranking positions, traffic estimates, or competition/" +
  "difficulty scores — you have no real data source for these. If you would normally cite a " +
  "number, state the assumption in words instead.\n" +
  "- Base every claim on the actual page data given to you, not generic assumptions about " +
  "this business category.\n" +
  "- Reason about the whole site as one business, not page by page — look for catalog-level " +
  "gaps (e.g. two products serving the same need with no comparison/bundle page between " +
  "them), not just isolated per-page issues.\n" +
  "- Write in the same language as the pages' own titles/H1s.\n\n" +
  "Respond ONLY with a JSON object shaped exactly like this, no other text, no markdown, no " +
  "code fences:\n" +
  '{"businessUnderstanding": string, "contentGapsSummary": string, ' +
  '"opportunities": [{"title": string, "searchIntent": string, "whyUsersSearch": string, ' +
  '"whyRevenue": string, "suggestedSlug": string, ' +
  '"pageType": "PRODUCT"|"LANDING"|"CATEGORY"|"COMPARISON"|"BLOG_ARTICLE"|"FAQ", ' +
  '"priority": "HIGH"|"MEDIUM"|"LOW"}, ...] (aim for 6-10), ' +
  '"conversionOpportunities": [{"pageUrl": string, "recommendation": string}, ...], ' +
  '"missingCompetitorPages": [string, ...], ' +
  '"topPages": [string, ...] (ranked highest-impact first, up to 10), ' +
  '"executiveSummary": string (top 3 actions for next month, as plain text)}';

interface AnthropicGrowthAnalysisProviderOptions {
  apiKey: string;
  model?: string;
}

// Same GrowthAnalysisPort contract as OpenAiGrowthAnalysisProvider, against
// Anthropic's Messages API instead — same request/response envelope
// distinction as the other Anthropic providers in this codebase.
export class AnthropicGrowthAnalysisProvider implements GrowthAnalysisPort {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: AnthropicGrowthAnalysisProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
  }

  async generateGrowthAnalysis(pages: readonly GrowthAnalysisPageContext[]): Promise<GrowthAnalysisResult> {
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
    return parseGrowthAnalysisResult(content);
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
