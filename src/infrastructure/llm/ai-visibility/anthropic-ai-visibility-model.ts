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

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-3-5-haiku-latest";
// Generous but bounded — long citation drafts run a while, but a hung
// connection must abort rather than freeze the whole probe. Mirrors the
// OpenAI model's timeout.
const DEFAULT_TIMEOUT_MS = 60_000;

const JUDGE_SYSTEM = 'You are a strict classifier. Answer with only "yes" or "no".';

// Anthropic's server-side web search tool. Enabling it lets Claude answer
// from live retrieval and attach per-source citations to its text blocks.
const WEB_SEARCH_TOOL = { type: "web_search_20250305", name: "web_search" };

// A single Anthropic content block, loosely typed — we only read the fields
// the web-search response uses (text + inline citations).
interface AnthropicBlock {
  type?: string;
  text?: unknown;
  citations?: { url?: unknown; title?: unknown }[];
}

// Pull cited sources out of a web-grounded Anthropic answer. Citations ride
// inside text blocks (one per cited span); de-dupe by url so one source cited
// several times counts once.
function extractCitations(blocks: AnthropicBlock[] | undefined): Citation[] {
  if (!Array.isArray(blocks)) return [];
  const byUrl = new Map<string, Citation>();
  for (const block of blocks) {
    for (const c of block.citations ?? []) {
      if (typeof c.url !== "string" || c.url.length === 0) continue;
      if (byUrl.has(c.url)) continue;
      byUrl.set(c.url, typeof c.title === "string" ? { url: c.url, title: c.title } : { url: c.url });
    }
  }
  return [...byUrl.values()];
}

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
  timeoutMs?: number;
}

// AiVisibilityModelPort over Anthropic Messages API — same request/response
// differences from Chat Completions as AnthropicRecommendationProvider
// (system is top-level, x-api-key auth, content is a typed-block array).
export class AnthropicAiVisibilityModel implements AiVisibilityModelPort {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: Options) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async engineId(): Promise<string> {
    return "anthropic";
  }

  async ask(query: string, mode: GroundingMode): Promise<AskResult> {
    // Warm temperature — the probe wants the real spread of answers a user
    // would see (Anthropic's range is 0..1).
    const { text, blocks } = await this.message(undefined, query, 1024, 1, {
      webSearch: mode === "web_grounded",
    });
    return mode === "web_grounded"
      ? { answer: text, citations: extractCitations(blocks), groundingMode: "web_grounded" }
      : { answer: text, citations: [], groundingMode: "parametric" };
  }

  async namesSpecificOption(answer: string): Promise<boolean> {
    const { text: verdict } = await this.message(JUDGE_SYSTEM, judgePrompt(answer), 5, 0);
    return verdict.trim().toLowerCase().startsWith("y");
  }

  async suggestProbeTarget(input: ProbeTargetSuggestionInput): Promise<ProbeTargetSuggestion> {
    const { text } = await this.message(SUGGEST_SYSTEM, buildSuggestUserPrompt(input), 1024, 0.4);
    return parseSuggestion(text);
  }

  async diagnoseVisibilityGap(input: VisibilityGapInput): Promise<string[]> {
    const { text } = await this.message(GAP_SYSTEM, buildGapUserPrompt(input), 1024, 0.4);
    return parseGaps(text);
  }

  async generateCitationContent(input: CitationContentInput): Promise<CitationDraft> {
    const { text } = await this.message(CITATION_SYSTEM, buildCitationUserPrompt(input), 4096, 0.5);
    return parseCitationDraft(text);
  }

  private async message(
    system: string | undefined,
    userContent: string,
    maxTokens: number,
    temperature: number,
    opts: { webSearch?: boolean } = {}
  ): Promise<{ text: string; blocks: AnthropicBlock[] | undefined }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(ANTHROPIC_API_URL, {
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
          ...(opts.webSearch ? { tools: [WEB_SEARCH_TOOL] } : {}),
          messages: [{ role: "user", content: userContent }],
        }),
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
      const body = await response.text().catch(() => "");
      throw new Error(`AI visibility model request failed (${response.status}): ${body}`);
    }

    const data: unknown = await response.json();
    const blocks = (data as { content?: AnthropicBlock[] })?.content;
    // A web-grounded answer streams its prose across several text blocks
    // (interleaved with search-result blocks), so join them rather than taking
    // just the first — otherwise we'd measure only the answer's opening span.
    const text = (blocks ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text as string)
      .join("");
    if (text.length === 0) {
      throw new Error("AI visibility model response did not contain message content");
    }
    return { text, blocks };
  }
}
