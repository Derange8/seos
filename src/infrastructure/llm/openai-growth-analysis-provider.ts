import type {
  GrowthAnalysisPageContext,
  GrowthAnalysisPort,
  GrowthAnalysisResult,
} from "@/application/content-enrichment/ports/growth-analysis-port";
import { isConversionOpportunity, isGrowthOpportunity, isStringArray } from "@/domain/content-enrichment/entities/growth-analysis";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

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

interface OpenAiGrowthAnalysisProviderOptions {
  apiKey: string;
  model?: string;
  // DeepSeek's API is OpenAI-Chat-Completions-compatible — same reuse
  // reasoning as the other OpenAI-shaped providers in this codebase.
  baseUrl?: string;
}

export class OpenAiGrowthAnalysisProvider implements GrowthAnalysisPort {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiUrl: string;

  constructor(options: OpenAiGrowthAnalysisProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
    this.apiUrl = options.baseUrl ?? OPENAI_API_URL;
  }

  async generateGrowthAnalysis(pages: readonly GrowthAnalysisPageContext[]): Promise<GrowthAnalysisResult> {
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
        temperature: 0.4,
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
    const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message
      ?.content;
    if (typeof content !== "string") {
      throw new Error("LLM response did not contain message content");
    }
    return content;
  }
}

// Shared by both OpenAI- and Anthropic-shaped providers, same pattern as
// parseContentIdeaSuggestions — only the raw-text extraction differs
// between them, not how that text is parsed once extracted. A malformed or
// missing field degrades that one field to an empty value/array rather
// than failing the whole report — a partial growth analysis is still more
// useful than none, and every field here is advisory text, not a value
// whose absence could silently corrupt something else.
export function parseGrowthAnalysisResult(content: string): GrowthAnalysisResult {
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error("LLM response content was not valid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("LLM response content was not a JSON object");
  }
  const obj = parsed as Record<string, unknown>;

  return {
    businessUnderstanding: typeof obj.businessUnderstanding === "string" ? obj.businessUnderstanding : "",
    contentGapsSummary: typeof obj.contentGapsSummary === "string" ? obj.contentGapsSummary : "",
    opportunities: Array.isArray(obj.opportunities) ? obj.opportunities.filter(isGrowthOpportunity) : [],
    conversionOpportunities: Array.isArray(obj.conversionOpportunities)
      ? obj.conversionOpportunities.filter(isConversionOpportunity)
      : [],
    missingCompetitorPages: isStringArray(obj.missingCompetitorPages) ? obj.missingCompetitorPages : [],
    topPages: isStringArray(obj.topPages) ? obj.topPages : [],
    executiveSummary: typeof obj.executiveSummary === "string" ? obj.executiveSummary : "",
  };
}
