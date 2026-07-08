import type { PrismaClient } from "@/generated/prisma/client";
import type { LlmCredentialRepositoryPort } from "@/application/settings/ports/llm-credential-repository-port";
import { LlmCredential } from "@/domain/settings/entities/llm-credential";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";
import { decryptCredential, encryptCredential } from "@/infrastructure/security/credential-cipher";

export class PrismaLlmCredentialRepository implements LlmCredentialRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async upsert(credential: LlmCredential): Promise<void> {
    const data = {
      encryptedApiKey: encryptCredential(credential.apiKey),
      model: credential.model,
    };
    await this.client.llmCredential.upsert({
      where: { provider: credential.provider },
      create: { provider: credential.provider, ...data },
      update: data,
    });
  }

  async findAll(): Promise<LlmCredential[]> {
    const rows = await this.client.llmCredential.findMany();
    return rows.map((row) =>
      LlmCredential.reconstitute({
        provider: row.provider,
        apiKey: decryptCredential(row.encryptedApiKey),
        model: row.model,
      })
    );
  }

  async remove(provider: LlmProvider): Promise<void> {
    await this.client.llmCredential.deleteMany({ where: { provider } });
  }
}
