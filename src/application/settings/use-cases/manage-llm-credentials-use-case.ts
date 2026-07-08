import { LlmCredential } from "@/domain/settings/entities/llm-credential";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";
import type { LlmCredentialRepositoryPort } from "@/application/settings/ports/llm-credential-repository-port";
import type { InvalidLlmApiKeyError, LlmCredentialValidatorPort } from "@/application/settings/ports/llm-credential-validator-port";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class EmptyLlmCredentialKeyError extends DomainError {
  readonly code = "EMPTY_LLM_CREDENTIAL_KEY";
}

export interface ManageLlmCredentialsDeps {
  credentialRepository: LlmCredentialRepositoryPort;
  validator: LlmCredentialValidatorPort;
}

// Manages the per-engine measurement keys (the multi-key store, separate from
// the single active LlmSettings). Save validates the key before persisting,
// same as SaveLlmSettingsUseCase — a stored key should always actually work.
export class ManageLlmCredentialsUseCase {
  constructor(private readonly deps: ManageLlmCredentialsDeps) {}

  async save(
    provider: LlmProvider,
    apiKeyInput: string,
    modelInput: string | null
  ): Promise<Result<LlmCredential, EmptyLlmCredentialKeyError | InvalidLlmApiKeyError>> {
    const apiKey = apiKeyInput.trim();
    if (apiKey.length === 0) {
      return err(new EmptyLlmCredentialKeyError("apiKey must not be empty"));
    }
    const validation = await this.deps.validator.validate(provider, apiKey);
    if (!validation.ok) return validation;

    const credential = LlmCredential.create(provider, apiKey, modelInput);
    await this.deps.credentialRepository.upsert(credential);
    return ok(credential);
  }

  // Which providers have a key configured (never returns the keys themselves).
  async listProviders(): Promise<LlmProvider[]> {
    const all = await this.deps.credentialRepository.findAll();
    return all.map((c) => c.provider);
  }

  async remove(provider: LlmProvider): Promise<void> {
    await this.deps.credentialRepository.remove(provider);
  }
}
