import type {
  GrowthAnalysisPageContext,
  GrowthAnalysisPort,
  GrowthAnalysisResult,
} from "@/application/content-enrichment/ports/growth-analysis-port";
import { isConversionOpportunity, isGrowthOpportunity, isStringArray } from "@/domain/content-enrichment/entities/growth-analysis";
import { GROWTH_ANALYSIS_SYSTEM_PROMPT } from "@/infrastructure/llm/growth-analysis-prompt";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

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
          { role: "system", content: GROWTH_ANALYSIS_SYSTEM_PROMPT },
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
