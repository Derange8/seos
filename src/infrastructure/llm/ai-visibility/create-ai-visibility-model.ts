import type { AiVisibilityModelPort } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";
import { OpenAiAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/openai-ai-visibility-model";
import { AnthropicAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/anthropic-ai-visibility-model";
import { GeminiAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/gemini-ai-visibility-model";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";

// The web-grounded measurement engines a multi-engine probe can fan out to.
// DeepSeek is intentionally excluded: it's OpenAI-compatible chat only, with no
// web search, so it can't produce a real AI-search reading (it would reject
// web_grounded). Order is the display order in the UI.
export const MEASUREMENT_ENGINES: readonly LlmProvider[] = ["openai", "anthropic", "gemini"];

export function isMeasurementEngine(provider: LlmProvider): boolean {
  return MEASUREMENT_ENGINES.includes(provider);
}

// Builds the concrete AiVisibilityModelPort for a provider+key. Shared by the
// single-engine DynamicAiVisibilityModel (resolves the active LlmSettings) and
// the multi-engine probe (iterates LlmCredential rows) so engine wiring lives
// in exactly one place.
export function createAiVisibilityModel(
  provider: LlmProvider,
  apiKey: string,
  model: string | null
): AiVisibilityModelPort {
  switch (provider) {
    case "openai":
      // Real OpenAI supports web search (a native tool) → enable web-grounded.
      return new OpenAiAiVisibilityModel({ apiKey, model: model ?? undefined, supportsWebSearch: true });
    case "anthropic":
      // Anthropic's Messages API has its own web_search tool, enabled per-call.
      return new AnthropicAiVisibilityModel({ apiKey, model: model ?? undefined });
    case "gemini":
      // Gemini's native google_search grounding tool. engineId() is "gemini".
      return new GeminiAiVisibilityModel({ apiKey, model: model ?? undefined });
    case "deepseek":
      // DeepSeek is only OpenAI-COMPATIBLE (chat surface) — no web search. Leave
      // supportsWebSearch off so a web_grounded probe honestly rejects here
      // instead of silently answering from memory.
      return new OpenAiAiVisibilityModel({
        apiKey,
        model: model ?? DEEPSEEK_DEFAULT_MODEL,
        baseUrl: DEEPSEEK_API_URL,
        supportsWebSearch: false,
        engineId: "deepseek",
      });
  }
}
