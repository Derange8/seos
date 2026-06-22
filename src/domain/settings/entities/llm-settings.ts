export type LlmProvider = "openai" | "anthropic" | "deepseek";

export interface LlmSettingsProps {
  provider: LlmProvider;
  // Plaintext in memory — encryption-at-rest is purely a repository/
  // infrastructure concern (see PrismaLlmSettingsRepository), the same
  // separation WordPressConnection already uses for its stored password.
  apiKey: string;
  model: string | null;
  updatedAt: Date;
}

// Not an aggregate root: no invariant beyond "these fields exist," and
// there's exactly one row for the whole install (see schema.prisma) —
// closer to WordPressConnection's shape than to a real aggregate.
export class LlmSettings {
  private constructor(private readonly props: LlmSettingsProps) {}

  static create(provider: LlmProvider, apiKey: string, model: string | null): LlmSettings {
    if (apiKey.trim().length === 0) {
      throw new Error("apiKey must not be empty");
    }
    // Every model identifier across all three providers (OpenAI,
    // Anthropic, DeepSeek) is conventionally lowercase — but the
    // credential validator only checks the API key itself, not the model
    // name, so a typo'd casing (e.g. "GPT-4o-mini") would otherwise be
    // silently accepted at save time and only fail later, deep inside the
    // recommendation queue, with no UI-visible error.
    const normalizedModel = model?.trim().toLowerCase() || null;
    return new LlmSettings({ provider, apiKey: apiKey.trim(), model: normalizedModel, updatedAt: new Date() });
  }

  static reconstitute(props: LlmSettingsProps): LlmSettings {
    return new LlmSettings(props);
  }

  get provider(): LlmProvider {
    return this.props.provider;
  }

  get apiKey(): string {
    return this.props.apiKey;
  }

  get model(): string | null {
    return this.props.model;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
