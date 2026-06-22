import type { PrismaClient } from "@/generated/prisma/client";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import { LlmSettings } from "@/domain/settings/entities/llm-settings";
import { decryptCredential, encryptCredential } from "@/infrastructure/security/credential-cipher";

// Fixed id enforces the single-row-per-install invariant at the DB level
// (see schema.prisma) — same upsert-on-a-well-known-id pattern used
// elsewhere in this codebase to avoid a "first call creates, second call
// races" bug.
const SINGLETON_ID = "singleton";

export class PrismaLlmSettingsRepository implements LlmSettingsRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async save(settings: LlmSettings): Promise<void> {
    const data = {
      provider: settings.provider,
      encryptedApiKey: encryptCredential(settings.apiKey),
      model: settings.model,
    };

    await this.client.llmSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });
  }

  async find(): Promise<LlmSettings | null> {
    const row = await this.client.llmSettings.findUnique({ where: { id: SINGLETON_ID } });
    if (!row) return null;

    return LlmSettings.reconstitute({
      provider: row.provider,
      apiKey: decryptCredential(row.encryptedApiKey),
      model: row.model,
      updatedAt: row.updatedAt,
    });
  }

  async clear(): Promise<void> {
    await this.client.llmSettings.deleteMany({ where: { id: SINGLETON_ID } });
  }
}
