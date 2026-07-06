import {
  NoLlmProviderConfiguredError,
  type ContentEnrichmentContext,
  type ContentEnrichmentPort,
} from "@/application/content-enrichment/ports/content-enrichment-port";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";
import { OpenAiContentSuggestionProvider } from "@/infrastructure/llm/openai-content-suggestion-provider";
import { AnthropicContentSuggestionProvider } from "@/infrastructure/llm/anthropic-content-suggestion-provider";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";
const GEMINI_OPENAI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

function createProviderFor(provider: LlmProvider, apiKey: string, model: string | null): ContentEnrichmentPort {
  switch (provider) {
    case "openai":
      return new OpenAiContentSuggestionProvider({ apiKey, model: model ?? undefined });
    case "anthropic":
      return new AnthropicContentSuggestionProvider({ apiKey, model: model ?? undefined });
    case "deepseek":
      return new OpenAiContentSuggestionProvider({
        apiKey,
        model: model ?? DEEPSEEK_DEFAULT_MODEL,
        baseUrl: DEEPSEEK_API_URL,
      });
    case "gemini":
      // Gemini's OpenAI-compatible chat endpoint — reused like DeepSeek.
      return new OpenAiContentSuggestionProvider({
        apiKey,
        model: model ?? GEMINI_DEFAULT_MODEL,
        baseUrl: GEMINI_OPENAI_URL,
      });
  }
}

// Same "re-read settings on every call" reasoning as DynamicRecommendationProvider
// — reuses whatever provider the user already configured in Settings for
// audit recommendations, rather than requiring a second API key setup just
// for content suggestions. Unlike DynamicRecommendationProvider, there's no
// template-based static fallback here: a generic, content-free placeholder
// paragraph isn't a usable substitute for an actual LLM-written suggestion,
// so an unconfigured provider is a real error, not a degraded mode.
export class DynamicContentSuggestionProvider implements ContentEnrichmentPort {
  constructor(private readonly settingsRepository: LlmSettingsRepositoryPort) {}

  async generateSuggestion(context: ContentEnrichmentContext): Promise<string> {
    const settings = await this.settingsRepository.find();
    if (!settings) {
      throw new NoLlmProviderConfiguredError("No LLM provider configured in Settings");
    }

    const provider = createProviderFor(settings.provider, settings.apiKey, settings.model);
    return provider.generateSuggestion(context);
  }
}
