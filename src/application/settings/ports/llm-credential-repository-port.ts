import type { LlmCredential } from "@/domain/settings/entities/llm-credential";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";

// Stores one API key per measurement engine (provider is the identity), the
// multi-key store the multi-engine probe reads. Separate from
// LlmSettingsRepositoryPort (the single active provider for content/audit).
export interface LlmCredentialRepositoryPort {
  // Create or replace the key for this provider.
  upsert(credential: LlmCredential): Promise<void>;
  // All configured engine credentials.
  findAll(): Promise<LlmCredential[]>;
  remove(provider: LlmProvider): Promise<void>;
}
