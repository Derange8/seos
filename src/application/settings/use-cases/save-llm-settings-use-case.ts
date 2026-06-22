import { LlmSettings, type LlmProvider } from "@/domain/settings/entities/llm-settings";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import type { InvalidLlmApiKeyError, LlmCredentialValidatorPort } from "@/application/settings/ports/llm-credential-validator-port";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class EmptyLlmApiKeyError extends DomainError {
  readonly code = "EMPTY_LLM_API_KEY";
}

export interface SaveLlmSettingsDeps {
  llmCredentialValidator: LlmCredentialValidatorPort;
  llmSettingsRepository: LlmSettingsRepositoryPort;
}

// Tests the key before persisting it, same reasoning as
// ConnectWordPressUseCase — a saved key should always actually work, so
// there's no separate "verified" state to model. Saving again overwrites
// the previous settings (see PrismaLlmSettingsRepository's fixed-id
// upsert) — there is exactly one configured provider per install.
export class SaveLlmSettingsUseCase {
  constructor(private readonly deps: SaveLlmSettingsDeps) {}

  async execute(
    provider: LlmProvider,
    apiKeyInput: string,
    modelInput: string | null
  ): Promise<Result<LlmSettings, EmptyLlmApiKeyError | InvalidLlmApiKeyError>> {
    const apiKey = apiKeyInput.trim();
    if (apiKey.length === 0) {
      return err(new EmptyLlmApiKeyError("apiKey must not be empty"));
    }

    const validation = await this.deps.llmCredentialValidator.validate(provider, apiKey);
    if (!validation.ok) return validation;

    const settings = LlmSettings.create(provider, apiKey, modelInput);
    await this.deps.llmSettingsRepository.save(settings);
    return ok(settings);
  }
}
