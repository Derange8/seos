import { describe, expect, it } from "vitest";
import { LlmSettings } from "@/domain/settings/entities/llm-settings";

describe("LlmSettings", () => {
  it("creates settings with a trimmed api key and model", () => {
    const settings = LlmSettings.create("openai", "  sk-key  ", "  gpt-4o-mini  ");

    expect(settings.provider).toBe("openai");
    expect(settings.apiKey).toBe("sk-key");
    expect(settings.model).toBe("gpt-4o-mini");
  });

  it("treats an empty/whitespace-only model as null", () => {
    const settings = LlmSettings.create("anthropic", "key", "   ");
    expect(settings.model).toBeNull();
  });

  it("lowercases the model name — every provider's model ids are conventionally lowercase, and a casing typo would otherwise be silently accepted and only fail later inside the recommendation queue", () => {
    const settings = LlmSettings.create("openai", "key", "GPT-4o-mini");
    expect(settings.model).toBe("gpt-4o-mini");
  });

  it("rejects an empty api key", () => {
    expect(() => LlmSettings.create("openai", "   ", null)).toThrow(/apiKey/);
  });
});
