import type { PrismaClient } from "@/generated/prisma/client";
import type { GoogleConnectionRepositoryPort } from "@/application/tracking/ports/google-connection-repository-port";
import { GoogleConnection } from "@/domain/tracking/entities/google-connection";
import { decryptCredential, encryptCredential } from "@/infrastructure/security/credential-cipher";

export class PrismaGoogleConnectionRepository implements GoogleConnectionRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async save(connection: GoogleConnection): Promise<void> {
    const data = {
      encryptedRefreshToken: encryptCredential(connection.refreshToken),
      gscSiteUrl: connection.gscSiteUrl,
      ga4PropertyId: connection.ga4PropertyId,
      autoRefreshEnabled: connection.autoRefreshEnabled,
    };

    await this.client.googleConnection.upsert({
      where: { projectId: connection.projectId },
      create: { id: connection.id, projectId: connection.projectId, ...data },
      update: data,
    });
  }

  async findByProjectId(projectId: string): Promise<GoogleConnection | null> {
    const row = await this.client.googleConnection.findUnique({ where: { projectId } });
    if (!row) return null;

    return GoogleConnection.reconstitute({
      id: row.id,
      projectId: row.projectId,
      refreshToken: decryptCredential(row.encryptedRefreshToken),
      gscSiteUrl: row.gscSiteUrl,
      ga4PropertyId: row.ga4PropertyId,
      autoRefreshEnabled: row.autoRefreshEnabled,
      createdAt: row.createdAt,
    });
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    await this.client.googleConnection.deleteMany({ where: { projectId } });
  }
}
