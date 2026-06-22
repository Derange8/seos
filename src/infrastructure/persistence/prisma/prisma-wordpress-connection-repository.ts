import type { PrismaClient } from "@/generated/prisma/client";
import type { WordPressConnectionRepositoryPort } from "@/application/wordpress/ports/wordpress-connection-repository-port";
import { WordPressConnection } from "@/domain/wordpress/entities/wordpress-connection";
import { decryptCredential, encryptCredential } from "@/infrastructure/security/credential-cipher";

export class PrismaWordPressConnectionRepository implements WordPressConnectionRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async save(connection: WordPressConnection): Promise<void> {
    const data = {
      siteUrl: connection.siteUrl,
      username: connection.username,
      encryptedPassword: encryptCredential(connection.applicationPassword),
    };

    await this.client.wordPressConnection.upsert({
      where: { projectId: connection.projectId },
      create: { id: connection.id, projectId: connection.projectId, ...data },
      update: data,
    });
  }

  async findByProjectId(projectId: string): Promise<WordPressConnection | null> {
    const row = await this.client.wordPressConnection.findUnique({ where: { projectId } });
    if (!row) return null;

    return WordPressConnection.reconstitute({
      id: row.id,
      projectId: row.projectId,
      siteUrl: row.siteUrl,
      username: row.username,
      applicationPassword: decryptCredential(row.encryptedPassword),
      createdAt: row.createdAt,
    });
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    await this.client.wordPressConnection.deleteMany({ where: { projectId } });
  }
}
