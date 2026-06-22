import { DomainError } from "@/shared/domain-error";
import type { Result } from "@/shared/result";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";

export class InvalidLlmApiKeyError extends DomainError {
  readonly code = "INVALID_LLM_API_KEY";
}

export interface LlmCredentialValidatorPort {
  // Makes one minimal, cheap real call to the provider (e.g. a models-list
  // endpoint, never a paid completion) so a typo'd or revoked key is caught
  // immediately instead of silently falling back to template-based
  // recommendations the first time a crawl finishes.
  validate(provider: LlmProvider, apiKey: string): Promise<Result<void, InvalidLlmApiKeyError>>;
}
