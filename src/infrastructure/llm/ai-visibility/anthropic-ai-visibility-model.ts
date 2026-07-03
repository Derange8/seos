import type {
  AiVisibilityModelPort,
  CitationContentInput,
  CitationDraft,
  ProbeTargetSuggestion,
  ProbeTargetSuggestionInput,
  VisibilityGapInput,
} from "@/application/ai-visibility/ports/ai-visibility-model-port";
import { SUGGEST_SYSTEM, buildSuggestUserPrompt, parseSuggestion } from "@/infrastructure/llm/ai-visibility/probe-target-prompt";
import { GAP_SYSTEM, buildGapUserPrompt, parseGaps } from "@/infrastructure/llm/ai-visibility/visibility-gap-prompt";
import { CITATION_SYSTEM, buildCitationUserPrompt, parseCitationDraft } from "@/infrastructure/llm/ai-visibility/citation-content-prompt";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-3-5-haiku-latest";

const JUDGE_SYSTEM = 'You are a strict classifier. Answer with only "yes" or "no".';

function judgePrompt(answer: string): string {
  return (
    "Does the following answer recommend or name at least one specific, real " +
    "product, platform, service, app, or website (an actual brand name), as " +
    'opposed to a generic non-committal answer? Answer only "yes" or "no".\n\n' +
    `"""${answer.slice(0, 1500)}"""`
  );
}

interface Options {
  apiKey: string;
  model?: string;
}

// AiVisibilityModelPort over Anthropic Messages API — same request/response
// differences from Chat Completions as AnthropicRecommendationProvider
// (system is top-level, x-api-key auth, content is a typed-block array).
export class AnthropicAiVisibilityModel implements AiVisibilityModelPort {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: Options) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
  }

  async ask(query: string): Promise<string> {
    // Warm temperature — the probe wants the real spread of answers a user
    // would see (Anthropic's range is 0..1).
    return this.message(undefined, query, 1024, 1);
  }

  async namesSpecificOption(answer: string): Promise<boolean> {
    const verdict = await this.message(JUDGE_SYSTEM, judgePrompt(answer), 5, 0);
    return verdict.trim().toLowerCase().startsWith("y");
  }

  async suggestProbeTarget(input: ProbeTargetSuggestionInput): Promise<ProbeTargetSuggestion> {
    const content = await this.message(SUGGEST_SYSTEM, buildSuggestUserPrompt(input), 1024, 0.4);
    return parseSuggestion(content);
  }

  async diagnoseVisibilityGap(input: VisibilityGapInput): Promise<string[]> {
    const content = await this.message(GAP_SYSTEM, buildGapUserPrompt(input), 1024, 0.4);
    return parseGaps(content);
  }

  async generateCitationContent(input: CitationContentInput): Promise<CitationDraft> {
    const content = await this.message(CITATION_SYSTEM, buildCitationUserPrompt(input), 4096, 0.5);
    return parseCitationDraft(content);
  }

  private async message(
    system: string | undefined,
    userContent: string,
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`AI visibility model request failed (${response.status}): ${body}`);
    }

    const data: unknown = await response.json();
    const blocks = (data as { content?: { type?: string; text?: unknown }[] })?.content;
    const text = blocks?.find((block) => block.type === "text")?.text;
    if (typeof text !== "string") {
      throw new Error("AI visibility model response did not contain message content");
    }
    return text;
  }
}
