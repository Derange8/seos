import type { AuditIssueRecommendationContext, LLMPort } from "@/application/auditing/ports/llm-port";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";
import type { Logger } from "@/shared/logger";
import { StaticRecommendationProvider } from "@/infrastructure/llm/static-recommendation-provider";
import { OpenAiRecommendationProvider } from "@/infrastructure/llm/openai-recommendation-provider";
import { AnthropicRecommendationProvider } from "@/infrastructure/llm/anthropic-recommendation-provider";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";
const GEMINI_OPENAI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

function createProviderFor(provider: LlmProvider, apiKey: string, model: string | null): LLMPort {
  switch (provider) {
    case "openai":
      return new OpenAiRecommendationProvider({ apiKey, model: model ?? undefined });
    case "anthropic":
      return new AnthropicRecommendationProvider({ apiKey, model: model ?? undefined });
    case "deepseek":
      return new OpenAiRecommendationProvider({
        apiKey,
        model: model ?? DEEPSEEK_DEFAULT_MODEL,
        baseUrl: DEEPSEEK_API_URL,
      });
    case "gemini":
      // Gemini's OpenAI-compatible chat endpoint — reused like DeepSeek.
      return new OpenAiRecommendationProvider({
        apiKey,
        model: model ?? GEMINI_DEFAULT_MODEL,
        baseUrl: GEMINI_OPENAI_URL,
      });
  }
}

// LLMPort implementation that re-reads LlmSettings from the database on
// every call instead of being constructed once at pipeline startup — the
// pipeline is a long-lived singleton (see crawl-pipeline.ts), but a user
// can add/change their API key in Settings at any time without restarting
// the app, so the choice of concrete provider can't be baked in at
// construction time the way it could be when the key only ever came from
// a startup-time env var.
export class DynamicRecommendationProvider implements LLMPort {
  constructor(
    private readonly settingsRepository: LlmSettingsRepositoryPort,
    private readonly logger: Logger
  ) {}

  async generateRecommendations(
    issues: readonly AuditIssueRecommendationContext[]
  ): Promise<Map<string, string>> {
    const settings = await this.settingsRepository.find();
    if (!settings) {
      this.logger.info("No LLM provider configured in Settings — using StaticRecommendationProvider (template-based, no LLM call)");
      return new StaticRecommendationProvider().generateRecommendations(issues);
    }

    this.logger.info("Using configured LLM provider", { provider: settings.provider, model: settings.model });
    const provider = createProviderFor(settings.provider, settings.apiKey, settings.model);
    return provider.generateRecommendations(issues);
  }
}
