import type { PrismaClient, LlmsTxtFile as PrismaLlmsTxtFileRow } from "@/generated/prisma/client";
import type { LlmsTxtRepositoryPort } from "@/application/llms-txt/ports/llms-txt-repository-port";
import { LlmsTxtFile } from "@/domain/llms-txt/entities/llms-txt-file";
import { sqliteWriteLock } from "@/shared/async-mutex";

function toDomain(row: PrismaLlmsTxtFileRow): LlmsTxtFile {
  return LlmsTxtFile.reconstitute({
    id: row.id,
    projectId: row.projectId,
    content: row.content,
    pageCount: row.pageCount,
    generatedAt: row.generatedAt,
  });
}

export class PrismaLlmsTxtRepository implements LlmsTxtRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  // Append-only history, not an upsert — same reasoning as
  // PrismaSitemapRepository (each crawl's llms.txt is its own row).
  async save(llmsTxtFile: LlmsTxtFile): Promise<void> {
    // Runs from CrawlJobCompleted — see AsyncMutex's doc comment.
    await sqliteWriteLock.runExclusive(() =>
      this.client.llmsTxtFile.create({
        data: {
          id: llmsTxtFile.id,
          projectId: llmsTxtFile.projectId,
          content: llmsTxtFile.content,
          pageCount: llmsTxtFile.pageCount,
          generatedAt: llmsTxtFile.generatedAt,
        },
      })
    );
  }

  async findLatestByProjectId(projectId: string): Promise<LlmsTxtFile | null> {
    const row = await this.client.llmsTxtFile.findFirst({
      where: { projectId },
      orderBy: { generatedAt: "desc" },
    });
    return row ? toDomain(row) : null;
  }
}
