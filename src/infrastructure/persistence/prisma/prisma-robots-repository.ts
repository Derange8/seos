import type { PrismaClient, RobotsFile as PrismaRobotsFileRow } from "@/generated/prisma/client";
import type { RobotsRepositoryPort } from "@/application/robots/ports/robots-repository-port";
import { RobotsFile } from "@/domain/robots/entities/robots-file";

function toDomain(row: PrismaRobotsFileRow): RobotsFile {
  return RobotsFile.reconstitute({
    id: row.id,
    projectId: row.projectId,
    content: row.content,
    generatedAt: row.generatedAt,
  });
}

export class PrismaRobotsRepository implements RobotsRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async save(robotsFile: RobotsFile): Promise<void> {
    await this.client.robotsFile.create({
      data: {
        id: robotsFile.id,
        projectId: robotsFile.projectId,
        content: robotsFile.content,
        generatedAt: robotsFile.generatedAt,
      },
    });
  }

  async findLatestByProjectId(projectId: string): Promise<RobotsFile | null> {
    const row = await this.client.robotsFile.findFirst({
      where: { projectId },
      orderBy: { generatedAt: "desc" },
    });
    return row ? toDomain(row) : null;
  }
}
