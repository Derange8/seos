import type {
  AiVisibilityModelPort,
  AskResult,
  CitationContentInput,
  CitationDraft,
  GroundingMode,
  ProbeTargetSuggestion,
  ProbeTargetSuggestionInput,
  VisibilityGapInput,
} from "@/application/ai-visibility/ports/ai-visibility-model-port";
import { AiVisibilityProviderNotConfiguredError } from "@/application/ai-visibility/errors";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";
import type { Logger } from "@/shared/logger";
import { OpenAiAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/openai-ai-visibility-model";
import { AnthropicAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/anthropic-ai-visibility-model";
import { GeminiAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/gemini-ai-visibility-model";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";

function createModelFor(provider: LlmProvider, apiKey: string, model: string | null): AiVisibilityModelPort {
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

  async engineId(): Promise<string> {
    // The configured provider IS the engine that measures this run. Resolve the
    // concrete model (which caches its own engineId) rather than re-reading
    // settings, so this agrees with whatever ask() actually dispatched to.
    return (await this.resolve()).engineId();
  }

  async ask(query: string, mode: GroundingMode): Promise<AskResult> {
    return (await this.resolve()).ask(query, mode);
  }

  async namesSpecificOption(answer: string): Promise<boolean> {
    return (await this.resolve()).namesSpecificOption(answer);
  }

  async suggestProbeTarget(input: ProbeTargetSuggestionInput): Promise<ProbeTargetSuggestion> {
    return (await this.resolve()).suggestProbeTarget(input);
  }

  async diagnoseVisibilityGap(input: VisibilityGapInput): Promise<string[]> {
    return (await this.resolve()).diagnoseVisibilityGap(input);
  }

  async generateCitationContent(input: CitationContentInput): Promise<CitationDraft> {
    return (await this.resolve()).generateCitationContent(input);
  }
}
