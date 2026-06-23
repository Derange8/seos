import {
  NoLlmProviderConfiguredError,
  type ContentIdeaPageContext,
  type ContentIdeaPort,
  type ContentIdeaSuggestion,
} from "@/application/content-enrichment/ports/content-idea-port";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";
import { OpenAiContentIdeaProvider } from "@/infrastructure/llm/openai-content-idea-provider";
import { AnthropicContentIdeaProvider } from "@/infrastructure/llm/anthropic-content-idea-provider";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";

function createProviderFor(provider: LlmProvider, apiKey: string, model: string | null): ContentIdeaPort {
  switch (provider) {
    case "openai":
      return new OpenAiContentIdeaProvider({ apiKey, model: model ?? undefined });
    case "anthropic":
      return new AnthropicContentIdeaProvider({ apiKey, model: model ?? undefined });
    case "deepseek":
      return new OpenAiContentIdeaProvider({
        apiKey,
        model: model ?? DEEPSEEK_DEFAULT_MODEL,
        baseUrl: DEEPSEEK_API_URL,
      });
  }
}

// Same "re-read settings on every call, no static fallback" reasoning as
// DynamicContentSuggestionProvider — a templated, content-free idea isn't a
// usable substitute for an actual LLM-written one, so an unconfigured
// provider is a real error, not a degraded mode.
export class DynamicContentIdeaProvider implements ContentIdeaPort {
  constructor(private readonly settingsRepository: LlmSettingsRepositoryPort) {}

  async generateContentIdeas(pages: readonly ContentIdeaPageContext[]): Promise<ContentIdeaSuggestion[]> {
    const settings = await this.settingsRepository.find();
    if (!settings) {
      throw new NoLlmProviderConfiguredError("No LLM provider configured in Settings");
    }

    const provider = createProviderFor(settings.provider, settings.apiKey, settings.model);
    return provider.generateContentIdeas(pages);
  }
}
