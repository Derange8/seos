import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaLlmSettingsRepository } from "@/infrastructure/persistence/prisma/prisma-llm-settings-repository";
import { LlmSettings } from "@/domain/settings/entities/llm-settings";

describe("PrismaLlmSettingsRepository", () => {
  const repository = new PrismaLlmSettingsRepository(prisma);

  afterEach(async () => {
    await repository.clear();
  });

  it("round-trips settings, decrypting the api key back to plaintext", async () => {
    const settings = LlmSettings.create("openai", "sk-super-secret-key", "gpt-4o-mini");
    await repository.save(settings);

    const found = await repository.find();
    expect(found?.provider).toBe("openai");
    expect(found?.apiKey).toBe("sk-super-secret-key");
    expect(found?.model).toBe("gpt-4o-mini");
  });

  it("stores the api key encrypted, not in plaintext, in the raw row", async () => {
    const settings = LlmSettings.create("openai", "sk-super-secret-key", null);
    await repository.save(settings);

    const row = await prisma.llmSettings.findUnique({ where: { id: "singleton" } });
    expect(row?.encryptedApiKey).not.toContain("sk-super-secret-key");
  });

  it("upserts on a second save rather than creating a second row", async () => {
    await repository.save(LlmSettings.create("openai", "first-key", null));
    await repository.save(LlmSettings.create("anthropic", "second-key", "claude-3-5-haiku-latest"));

    const found = await repository.find();
    expect(found?.provider).toBe("anthropic");
    expect(found?.apiKey).toBe("second-key");
    expect(found?.model).toBe("claude-3-5-haiku-latest");

    const count = await prisma.llmSettings.count();
    expect(count).toBe(1);
  });

  it("returns null when nothing has been configured yet", async () => {
    const found = await repository.find();
    expect(found).toBeNull();
  });

  it("clear removes the settings", async () => {
    await repository.save(LlmSettings.create("deepseek", "some-key", null));
    await repository.clear();

    const found = await repository.find();
    expect(found).toBeNull();
  });
});
