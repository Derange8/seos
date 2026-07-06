import {
  NoLlmProviderConfiguredError,
  type GrowthAnalysisPageContext,
  type GrowthAnalysisPort,
  type GrowthAnalysisResult,
} from "@/application/content-enrichment/ports/growth-analysis-port";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";
import { OpenAiGrowthAnalysisProvider } from "@/infrastructure/llm/openai-growth-analysis-provider";
import { AnthropicGrowthAnalysisProvider } from "@/infrastructure/llm/anthropic-growth-analysis-provider";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";
const GEMINI_OPENAI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

function createProviderFor(provider: LlmProvider, apiKey: string, model: string | null): GrowthAnalysisPort {
  switch (provider) {
    case "openai":
      return new OpenAiGrowthAnalysisProvider({ apiKey, model: model ?? undefined });
    case "anthropic":
      return new AnthropicGrowthAnalysisProvider({ apiKey, model: model ?? undefined });
    case "deepseek":
      return new OpenAiGrowthAnalysisProvider({
        apiKey,
        model: model ?? DEEPSEEK_DEFAULT_MODEL,
        baseUrl: DEEPSEEK_API_URL,
      });
    case "gemini":
      // Gemini's OpenAI-compatible chat endpoint — reused like DeepSeek.
      return new OpenAiGrowthAnalysisProvider({
        apiKey,
        model: model ?? GEMINI_DEFAULT_MODEL,
        baseUrl: GEMINI_OPENAI_URL,
      });
  }
}

// Same "re-read settings on every call, no static fallback" reasoning as
// DynamicContentIdeaProvider — there is no template-based substitute for a
// genuine business-growth analysis, so an unconfigured provider is a real
// error, not a degraded mode.
export class DynamicGrowthAnalysisProvider implements GrowthAnalysisPort {
  constructor(private readonly settingsRepository: LlmSettingsRepositoryPort) {}

  async generateGrowthAnalysis(pages: readonly GrowthAnalysisPageContext[]): Promise<GrowthAnalysisResult> {
    const settings = await this.settingsRepository.find();
    if (!settings) {
      throw new NoLlmProviderConfiguredError("No LLM provider configured in Settings");
    }

    const provider = createProviderFor(settings.provider, settings.apiKey, settings.model);
    return provider.generateGrowthAnalysis(pages);
  }
}
