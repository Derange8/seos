import type {
  AiVisibilityModelPort,
  ProbeTargetSuggestion,
  ProbeTargetSuggestionInput,
} from "@/application/ai-visibility/ports/ai-visibility-model-port";
import { AiVisibilityProviderNotConfiguredError } from "@/application/ai-visibility/errors";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";
import type { Logger } from "@/shared/logger";
import { OpenAiAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/openai-ai-visibility-model";
import { AnthropicAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/anthropic-ai-visibility-model";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";

function createModelFor(provider: LlmProvider, apiKey: string, model: string | null): AiVisibilityModelPort {
  switch (provider) {
    case "openai":
      return new OpenAiAiVisibilityModel({ apiKey, model: model ?? undefined });
    case "anthropic":
      return new AnthropicAiVisibilityModel({ apiKey, model: model ?? undefined });
    case "deepseek":
      return new OpenAiAiVisibilityModel({ apiKey, model: model ?? DEEPSEEK_DEFAULT_MODEL, baseUrl: DEEPSEEK_API_URL });
  }
}

// Resolves the configured LLM provider from Settings, exactly like
// DynamicRecommendationProvider — but unlike that (a long-lived pipeline
// singleton that re-reads on every call), a probe is triggered on demand and
// this is constructed fresh per run, so it resolves settings once and caches
// the concrete model for the run's lifetime (a probe makes many ask() calls;
// re-reading the DB on each would be needless). No configured provider is a
// real error here — there is no offline fallback for measuring AI visibility.
export class DynamicAiVisibilityModel implements AiVisibilityModelPort {
  private resolved?: Promise<AiVisibilityModelPort>;

  constructor(
    private readonly settingsRepository: LlmSettingsRepositoryPort,
    private readonly logger: Logger
  ) {}

  private resolve(): Promise<AiVisibilityModelPort> {
    if (!this.resolved) {
      this.resolved = (async () => {
        const settings = await this.settingsRepository.find();
        if (!settings) throw new AiVisibilityProviderNotConfiguredError();
        this.logger.info("AI visibility probe using configured LLM provider", {
          provider: settings.provider,
          model: settings.model,
        });
        return createModelFor(settings.provider, settings.apiKey, settings.model);
      })();
    }
    return this.resolved;
  }

  async ask(query: string): Promise<string> {
    return (await this.resolve()).ask(query);
  }

  async namesSpecificOption(answer: string): Promise<boolean> {
    return (await this.resolve()).namesSpecificOption(answer);
  }

  async suggestProbeTarget(input: ProbeTargetSuggestionInput): Promise<ProbeTargetSuggestion> {
    return (await this.resolve()).suggestProbeTarget(input);
  }
}
