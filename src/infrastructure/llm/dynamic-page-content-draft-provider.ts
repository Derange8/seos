import {
  NoLlmProviderConfiguredError,
  type PageContentDraftContext,
  type PageContentDraftPort,
  type PageContentDraftResult,
} from "@/application/content-enrichment/ports/page-content-draft-port";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";
import { OpenAiPageContentDraftProvider } from "@/infrastructure/llm/openai-page-content-draft-provider";
import { AnthropicPageContentDraftProvider } from "@/infrastructure/llm/anthropic-page-content-draft-provider";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";

function createProviderFor(provider: LlmProvider, apiKey: string, model: string | null): PageContentDraftPort {
  switch (provider) {
    case "openai":
      return new OpenAiPageContentDraftProvider({ apiKey, model: model ?? undefined });
    case "anthropic":
      return new AnthropicPageContentDraftProvider({ apiKey, model: model ?? undefined });
    case "deepseek":
      return new OpenAiPageContentDraftProvider({
        apiKey,
        model: model ?? DEEPSEEK_DEFAULT_MODEL,
        baseUrl: DEEPSEEK_API_URL,
      });
  }
}

// Same "re-read settings on every call, no static fallback" reasoning as the
// other dynamic content-enrichment providers — a templated draft is no
// substitute for an LLM-written one, so an unconfigured provider is a real
// error.
export class DynamicPageContentDraftProvider implements PageContentDraftPort {
  constructor(private readonly settingsRepository: LlmSettingsRepositoryPort) {}

  async generateDraft(context: PageContentDraftContext): Promise<PageContentDraftResult> {
    const settings = await this.settingsRepository.find();
    if (!settings) {
      throw new NoLlmProviderConfiguredError("No LLM provider configured in Settings");
    }

    const provider = createProviderFor(settings.provider, settings.apiKey, settings.model);
    return provider.generateDraft(context);
  }
}
