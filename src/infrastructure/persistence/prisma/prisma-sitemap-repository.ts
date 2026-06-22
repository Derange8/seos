import type { PrismaClient, SitemapFile as PrismaSitemapFileRow } from "@/generated/prisma/client";
import type { SitemapRepositoryPort } from "@/application/sitemap/ports/sitemap-repository-port";
import { SitemapFile } from "@/domain/sitemap/entities/sitemap-file";
import { sqliteWriteLock } from "@/shared/async-mutex";

function toDomain(row: PrismaSitemapFileRow): SitemapFile {
  return SitemapFile.reconstitute({
    id: row.id,
    projectId: row.projectId,
    content: row.content,
    pageCount: row.pageCount,
    generatedAt: row.generatedAt,
  });
}

export class PrismaSitemapRepository implements SitemapRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  // Append-only history, not an upsert — each crawl's sitemap is its own
  // row (mirrors AuditRun), and findLatestByProjectId surfaces the current
  // one.
  async save(sitemapFile: SitemapFile): Promise<void> {
    // Runs from CrawlJobCompleted, alongside other handlers and possibly
    // still-settling concurrent page saves — see AsyncMutex's doc comment.
    await sqliteWriteLock.runExclusive(() =>
      this.client.sitemapFile.create({
        data: {
          id: sitemapFile.id,
          projectId: sitemapFile.projectId,
          content: sitemapFile.content,
          pageCount: sitemapFile.pageCount,
          generatedAt: sitemapFile.generatedAt,
        },
      })
    );
  }

  async findLatestByProjectId(projectId: string): Promise<SitemapFile | null> {
    const row = await this.client.sitemapFile.findFirst({
      where: { projectId },
      orderBy: { generatedAt: "desc" },
    });
    return row ? toDomain(row) : null;
  }
}
