import type { LlmProvider } from "@/domain/settings/entities/llm-settings";

export interface LlmCredentialProps {
  provider: LlmProvider;
  // Plaintext in memory; encrypted at rest by the repository (same split as
  // LlmSettings / WordPressConnection).
  apiKey: string;
  model: string | null;
}

// One stored API key for a measurement engine, keyed by provider. Distinct
// from LlmSettings (the single "active" provider the content/audit pipeline
// uses): a project can have keys for several engines at once, and a
// multi-engine probe measures on all of them in parallel. At most one row per
// provider (provider is the identity).
export class LlmCredential {
  private constructor(private readonly props: LlmCredentialProps) {}

  static create(provider: LlmProvider, apiKey: string, model: string | null): LlmCredential {
    if (apiKey.trim().length === 0) {
      throw new Error("apiKey must not be empty");
    }
    // Same casing normalization as LlmSettings — a typo'd model case would
    // otherwise be accepted at save and only fail later at call time.
    const normalizedModel = model?.trim().toLowerCase() || null;
    return new LlmCredential({ provider, apiKey: apiKey.trim(), model: normalizedModel });
  }

  static reconstitute(props: LlmCredentialProps): LlmCredential {
    return new LlmCredential(props);
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
}
