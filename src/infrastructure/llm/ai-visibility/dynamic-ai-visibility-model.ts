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
import type { Logger } from "@/shared/logger";
import { createAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/create-ai-visibility-model";

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
        return createAiVisibilityModel(settings.provider, settings.apiKey, settings.model);
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
