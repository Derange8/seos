import type { LlmProvider } from "@/domain/settings/entities/llm-settings";
import { InvalidLlmApiKeyError, type LlmCredentialValidatorPort } from "@/application/settings/ports/llm-credential-validator-port";
import { err, ok, type Result } from "@/shared/result";

interface ProviderCheck {
  url: string;
  headers: Record<string, string>;
}

function checkFor(provider: LlmProvider, apiKey: string): ProviderCheck {
  switch (provider) {
    case "openai":
      return { url: "https://api.openai.com/v1/models", headers: { authorization: `Bearer ${apiKey}` } };
    case "deepseek":
      // OpenAI-compatible API — same auth scheme and a models-list endpoint.
      return { url: "https://api.deepseek.com/v1/models", headers: { authorization: `Bearer ${apiKey}` } };
    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/models",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      };
  }
}

// Makes one cheap, free GET request (a models list, never a paid
// completion) to confirm the key actually authenticates before
// SaveLlmSettingsUseCase persists it — catches a typo'd or revoked key
// immediately rather than discovering it the next time a crawl finishes.
export class LlmCredentialValidator implements LlmCredentialValidatorPort {
  async validate(provider: LlmProvider, apiKey: string): Promise<Result<void, InvalidLlmApiKeyError>> {
    const { url, headers } = checkFor(provider, apiKey);

    let response: Response;
    try {
      response = await fetch(url, { headers });
    } catch (error) {
      return err(new InvalidLlmApiKeyError(`Could not reach ${provider}'s API to verify the key: ${String(error)}`));
    }

    if (response.status === 401 || response.status === 403) {
      return err(new InvalidLlmApiKeyError(`${provider} rejected this API key (${response.status})`));
    }
    if (!response.ok) {
      return err(new InvalidLlmApiKeyError(`${provider} API check failed unexpectedly (${response.status})`));
    }
    return ok(undefined);
  }
}
