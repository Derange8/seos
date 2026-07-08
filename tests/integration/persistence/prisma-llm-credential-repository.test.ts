import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaLlmCredentialRepository } from "@/infrastructure/persistence/prisma/prisma-llm-credential-repository";
import { LlmCredential } from "@/domain/settings/entities/llm-credential";

describe("PrismaLlmCredentialRepository", () => {
  const repository = new PrismaLlmCredentialRepository(prisma);

  afterEach(async () => {
    await prisma.llmCredential.deleteMany();
  });

  it("round-trips multiple engine credentials, decrypting keys back", async () => {
    await repository.upsert(LlmCredential.create("openai", "sk-openai", "gpt-4o"));
    await repository.upsert(LlmCredential.create("gemini", "AQ-gemini", null));

    const all = await repository.findAll();
    const byProvider = Object.fromEntries(all.map((c) => [c.provider, c]));
    expect(byProvider.openai.apiKey).toBe("sk-openai");
    expect(byProvider.openai.model).toBe("gpt-4o");
    expect(byProvider.gemini.apiKey).toBe("AQ-gemini");
    expect(all).toHaveLength(2);
  });

  it("stores keys encrypted, not plaintext, in the raw row", async () => {
    await repository.upsert(LlmCredential.create("anthropic", "sk-super-secret", null));
    const row = await prisma.llmCredential.findUnique({ where: { provider: "anthropic" } });
    expect(row?.encryptedApiKey).not.toContain("sk-super-secret");
  });

  it("upserts per provider — a second save for the same provider replaces, not duplicates", async () => {
    await repository.upsert(LlmCredential.create("openai", "first", null));
    await repository.upsert(LlmCredential.create("openai", "second", "gpt-4o"));

    const all = await repository.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].apiKey).toBe("second");
    expect(all[0].model).toBe("gpt-4o");
  });

  it("remove deletes only the named provider", async () => {
    await repository.upsert(LlmCredential.create("openai", "k1", null));
    await repository.upsert(LlmCredential.create("gemini", "k2", null));
    await repository.remove("openai");

    const all = await repository.findAll();
    expect(all.map((c) => c.provider)).toEqual(["gemini"]);
  });
});
