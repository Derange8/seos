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

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// gemini-2.0-flash is free-tier-limit-0 on the current key; 2.5-flash works and
// supports the google_search grounding tool. (Verified with a real call.)
const DEFAULT_MODEL = "gemini-2.5-flash";
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

// One grounding chunk from a web-grounded Gemini answer.
interface GeminiGroundingChunk {
  web?: { uri?: unknown; title?: unknown };
}

// Pull cited sources out of a Gemini grounded answer.
//
// CRITICAL (verified against a real call): groundingChunks[].web.uri is ALWAYS
// a Gemini redirect proxy (vertexaisearch.cloud.google.com/grounding-api-
// redirect/...), NOT the real source domain — the real domain is in web.title
// (e.g. "bleap.finance"). Unlike OpenAI/Anthropic, whose citation url IS the
// real url. citesDomain() matches on the url's host, so if we stored the
// redirect uri here, citation-of-the-target-domain would silently never match.
// So the Citation.url we surface is the real domain from title; the redirect
// uri is dropped (it's a click-through wrapper, not evidence of a domain).
function extractCitations(chunks: GeminiGroundingChunk[] | undefined): Citation[] {
  if (!Array.isArray(chunks)) return [];
  const byDomain = new Map<string, Citation>();
  for (const chunk of chunks) {
    const title = chunk.web?.title;
    if (typeof title !== "string" || title.length === 0) continue;
    // title is the real registrable domain; use it as both url (for domain
    // matching) and title.
    if (!byDomain.has(title)) byDomain.set(title, { url: title, title });
  }
  return [...byDomain.values()];
}

interface Options {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
}

// AiVisibilityModelPort over Google's Gemini API (generateContent). Web
// grounding is the native google_search tool; citations come from
// groundingMetadata.groundingChunks (see extractCitations for the redirect
// caveat). JSON mode is generationConfig.responseMimeType (Gemini-specific,
// unlike OpenAI's response_format).
export class GeminiAiVisibilityModel implements AiVisibilityModelPort {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: Options) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async engineId(): Promise<string> {
    return "gemini";
  }

  async ask(query: string, mode: GroundingMode): Promise<AskResult> {
    if (mode === "web_grounded") {
      const { text, chunks } = await this.generate(undefined, query, { webSearch: true, temperature: 0.7 });
      return { answer: text, citations: extractCitations(chunks), groundingMode: "web_grounded" };
    }
    const { text } = await this.generate(undefined, query, { temperature: 0.7 });
    return { answer: text, citations: [], groundingMode: "parametric" };
  }

  async namesSpecificOption(answer: string): Promise<boolean> {
    const { text } = await this.generate(JUDGE_SYSTEM, judgePrompt(answer), { temperature: 0 });
    return text.trim().toLowerCase().startsWith("y");
  }

  async suggestProbeTarget(input: ProbeTargetSuggestionInput): Promise<ProbeTargetSuggestion> {
    const { text } = await this.generate(SUGGEST_SYSTEM, buildSuggestUserPrompt(input), { temperature: 0.4, json: true });
    return parseSuggestion(text);
  }

  async diagnoseVisibilityGap(input: VisibilityGapInput): Promise<string[]> {
    const { text } = await this.generate(GAP_SYSTEM, buildGapUserPrompt(input), { temperature: 0.4, json: true });
    return parseGaps(text);
  }

  async generateCitationContent(input: CitationContentInput): Promise<CitationDraft> {
    const { text } = await this.generate(CITATION_SYSTEM, buildCitationUserPrompt(input), { temperature: 0.5, json: true });
    return parseCitationDraft(text);
  }

  private async generate(
    system: string | undefined,
    userContent: string,
    opts: { webSearch?: boolean; json?: boolean; temperature: number }
  ): Promise<{ text: string; chunks: GeminiGroundingChunk[] | undefined }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      generationConfig: {
        temperature: opts.temperature,
        // Grounding and JSON mode are mutually exclusive on Gemini — a grounded
        // answer is prose with citations, not JSON.
        ...(opts.json && !opts.webSearch ? { responseMimeType: "application/json" } : {}),
      },
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      ...(opts.webSearch ? { tools: [{ google_search: {} }] } : {}),
    };

    let response: Response;
    try {
      response = await fetch(`${GEMINI_API_BASE}/${this.model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
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
    const candidate = (data as { candidates?: { content?: { parts?: { text?: unknown }[] }; groundingMetadata?: { groundingChunks?: GeminiGroundingChunk[] } }[] })
      ?.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const text = parts
      .map((p) => p.text)
      .filter((t): t is string => typeof t === "string")
      .join("");
    if (text.length === 0) {
      throw new Error("AI visibility model response did not contain message content");
    }
    return { text, chunks: candidate?.groundingMetadata?.groundingChunks };
  }
}
