import type {
  AiVisibilityModelPort,
  AskResult,
  Citation,
  CitationContentInput,
  CitationDraft,
  GroundingMode,
  ProbeTargetSuggestion,
  ProbeTargetSuggestionInput,
  VisibilityGapInput,
} from "@/application/ai-visibility/ports/ai-visibility-model-port";
import { SUGGEST_SYSTEM, buildSuggestUserPrompt, parseSuggestion } from "@/infrastructure/llm/ai-visibility/probe-target-prompt";
import { GAP_SYSTEM, buildGapUserPrompt, parseGaps } from "@/infrastructure/llm/ai-visibility/visibility-gap-prompt";
import { CITATION_SYSTEM, buildCitationUserPrompt, parseCitationDraft } from "@/infrastructure/llm/ai-visibility/citation-content-prompt";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
// LLM calls legitimately run longer than a page fetch (JSON-mode generation,
// long citation drafts), so this is generous — but bounded, so a hung
// connection aborts instead of freezing the whole probe forever.
const DEFAULT_TIMEOUT_MS = 60_000;

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
  // DeepSeek reuses this class via its OpenAI-compatible endpoint, exactly
  // like OpenAiRecommendationProvider.
  baseUrl?: string;
  // Web search is an OpenAI-native capability, not part of the
  // OpenAI-compatible surface DeepSeek and friends implement. So it's opt-in:
  // the dynamic model turns it on only for real OpenAI, and leaves it false
  // for compatible-endpoint providers — which then honestly reject
  // web_grounded rather than pretend.
  supportsWebSearch?: boolean;
  // The web-search-enabled model to use for grounded asks (the default chat
  // model may not support the web_search tool). Only used in web_grounded mode.
  webSearchModel?: string;
  timeoutMs?: number;
}

const DEFAULT_WEB_SEARCH_MODEL = "gpt-4o-search-preview";

// One url_citation annotation from a Chat Completions web-search answer.
interface UrlCitationAnnotation {
  type?: string;
  url_citation?: { url?: unknown; title?: unknown };
}

// Pull the cited sources out of a web-search answer's message annotations,
// keeping only well-formed url_citation entries with a usable url.
function extractCitations(annotations: unknown): Citation[] {
  if (!Array.isArray(annotations)) return [];
  const out: Citation[] = [];
  for (const raw of annotations as UrlCitationAnnotation[]) {
    if (raw?.type !== "url_citation") continue;
    const url = raw.url_citation?.url;
    if (typeof url !== "string" || url.length === 0) continue;
    const title = raw.url_citation?.title;
    out.push(typeof title === "string" ? { url, title } : { url });
  }
  return out;
}

// AiVisibilityModelPort over OpenAI Chat Completions. `ask` uses a warm
// temperature on purpose — the probe measures the DISTRIBUTION of answers a
// real user would get, so variance is the signal, not noise; `namesSpecificOption`
// uses temperature 0 for a stable classification.
export class OpenAiAiVisibilityModel implements AiVisibilityModelPort {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly supportsWebSearch: boolean;
  private readonly webSearchModel: string;

  constructor(options: Options) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
    this.apiUrl = options.baseUrl ?? OPENAI_API_URL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.supportsWebSearch = options.supportsWebSearch ?? false;
    this.webSearchModel = options.webSearchModel ?? DEFAULT_WEB_SEARCH_MODEL;
  }

  async ask(query: string, mode: GroundingMode): Promise<AskResult> {
    if (mode === "web_grounded") {
      if (!this.supportsWebSearch) {
        // Never silently degrade to parametric — that would report a
        // memory-only reading as if it were a real AI-search reading.
        throw new Error("This provider does not support web-grounded AI visibility probing");
      }
      const { content, annotations } = await this.chat(
        [{ role: "user", content: query }],
        0.7,
        { webSearch: true }
      );
      return { answer: content, citations: extractCitations(annotations), groundingMode: "web_grounded" };
    }

    const { content } = await this.chat([{ role: "user", content: query }], 0.7);
    return { answer: content, citations: [], groundingMode: "parametric" };
  }

  async namesSpecificOption(answer: string): Promise<boolean> {
    const { content: verdict } = await this.chat(
      [
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: judgePrompt(answer) },
      ],
      0
    );
    return verdict.trim().toLowerCase().startsWith("y");
  }

  async suggestProbeTarget(input: ProbeTargetSuggestionInput): Promise<ProbeTargetSuggestion> {
    const { content } = await this.chat(
      [
        { role: "system", content: SUGGEST_SYSTEM },
        { role: "user", content: buildSuggestUserPrompt(input) },
      ],
      0.4,
      { jsonMode: true }
    );
    return parseSuggestion(content);
  }

  async diagnoseVisibilityGap(input: VisibilityGapInput): Promise<string[]> {
    const { content } = await this.chat(
      [
        { role: "system", content: GAP_SYSTEM },
        { role: "user", content: buildGapUserPrompt(input) },
      ],
      0.4,
      { jsonMode: true }
    );
    return parseGaps(content);
  }

  async generateCitationContent(input: CitationContentInput): Promise<CitationDraft> {
    const { content } = await this.chat(
      [
        { role: "system", content: CITATION_SYSTEM },
        { role: "user", content: buildCitationUserPrompt(input) },
      ],
      0.5,
      { jsonMode: true }
    );
    return parseCitationDraft(content);
  }

  private async chat(
    messages: { role: string; content: string }[],
    temperature: number,
    opts: { jsonMode?: boolean; webSearch?: boolean } = {}
  ): Promise<{ content: string; annotations: unknown }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    // Web search runs on a dedicated search model that does NOT accept a
    // temperature param and needs web_search_options; the normal chat path
    // keeps temperature (variance is the probe's signal) and optional JSON mode.
    const body = opts.webSearch
      ? { model: this.webSearchModel, messages, web_search_options: {} }
      : {
          model: this.model,
          messages,
          temperature,
          ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
        };

    let response: Response;
    try {
      response = await fetch(this.apiUrl, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`AI visibility model request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`AI visibility model request failed (${response.status}): ${errBody}`);
    }

    const data: unknown = await response.json();
    const message = (data as { choices?: { message?: { content?: unknown; annotations?: unknown } }[] })
      ?.choices?.[0]?.message;
    const content = message?.content;
    if (typeof content !== "string") {
      throw new Error("AI visibility model response did not contain message content");
    }
    return { content, annotations: message?.annotations };
  }
}
