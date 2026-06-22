import { describe, expect, it, vi } from "vitest";
import { SaveLlmSettingsUseCase } from "@/application/settings/use-cases/save-llm-settings-use-case";
import { InvalidLlmApiKeyError } from "@/application/settings/ports/llm-credential-validator-port";
import { ok, err } from "@/shared/result";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import type { LlmCredentialValidatorPort } from "@/application/settings/ports/llm-credential-validator-port";

function deps(overrides: Partial<{ validator: LlmCredentialValidatorPort; repository: LlmSettingsRepositoryPort }> = {}) {
  const validator: LlmCredentialValidatorPort = overrides.validator ?? { validate: vi.fn().mockResolvedValue(ok(undefined)) };
  const repository: LlmSettingsRepositoryPort = overrides.repository ?? {
    save: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockResolvedValue(null),
    clear: vi.fn().mockResolvedValue(undefined),
  };
  return { llmCredentialValidator: validator, llmSettingsRepository: repository };
}

describe("SaveLlmSettingsUseCase", () => {
  it("rejects an empty api key without calling the validator", async () => {
    const dependencies = deps();
    const useCase = new SaveLlmSettingsUseCase(dependencies);

    const result = await useCase.execute("openai", "   ", null);

    expect(result.ok).toBe(false);
    expect(dependencies.llmCredentialValidator.validate).not.toHaveBeenCalled();
  });

  it("propagates a validator failure instead of saving", async () => {
    const dependencies = deps({ validator: { validate: vi.fn().mockResolvedValue(err(new InvalidLlmApiKeyError("nope"))) } });
    const useCase = new SaveLlmSettingsUseCase(dependencies);

    const result = await useCase.execute("openai", "bad-key", null);

    expect(result.ok).toBe(false);
    expect(dependencies.llmSettingsRepository.save).not.toHaveBeenCalled();
  });

  it("saves settings once the key validates", async () => {
    const dependencies = deps();
    const useCase = new SaveLlmSettingsUseCase(dependencies);

    const result = await useCase.execute("anthropic", "good-key", "claude-3-5-haiku-latest");

    expect(result.ok).toBe(true);
    expect(dependencies.llmSettingsRepository.save).toHaveBeenCalledTimes(1);
    if (result.ok) {
      expect(result.value.provider).toBe("anthropic");
      expect(result.value.model).toBe("claude-3-5-haiku-latest");
    }
  });
});
