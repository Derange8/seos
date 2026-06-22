import type { PrismaClient, CrawlJob as PrismaCrawlJobRow, Prisma } from "@/generated/prisma/client";
import type { CrawlJobRepositoryPort } from "@/application/crawling/ports/crawl-job-repository-port";
import { CrawlJob, type CrawlStatus } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig, type CrawlConfigProps } from "@/domain/crawling/value-objects/crawl-config";
import { sqliteWriteLock } from "@/shared/async-mutex";

function toDomain(row: PrismaCrawlJobRow): CrawlJob {
  const configResult = CrawlConfig.create(row.config as unknown as CrawlConfigProps);
  if (!configResult.ok) {
    throw new Error(
      `Crawl job "${row.id}" has a corrupt persisted config: ${configResult.error.message}`
    );
  }

  return CrawlJob.reconstitute({
    id: row.id,
    projectId: row.projectId,
    config: configResult.value,
    status: row.status as CrawlStatus,
    pageCount: row.pageCount,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    error: row.error,
  });
}

export class PrismaCrawlJobRepository implements CrawlJobRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async save(crawlJob: CrawlJob): Promise<void> {
    // pageCount is deliberately excluded from `update` — it is only ever
    // mutated via incrementPageCount()'s atomic DB increment, never via a
    // full-aggregate overwrite, which would race with concurrent workers.
    const updateData = {
      status: crawlJob.status,
      startedAt: crawlJob.startedAt,
      finishedAt: crawlJob.finishedAt,
      error: crawlJob.error,
    };

    // Called at crawl start and at finalize-on-completion, the latter
    // landing right in the same window as still-settling concurrent page
    // writes — see AsyncMutex's doc comment.
    await sqliteWriteLock.runExclusive(() =>
      this.client.crawlJob.upsert({
        where: { id: crawlJob.id },
        create: {
          id: crawlJob.id,
          projectId: crawlJob.projectId,
          config: crawlJob.config.toJSON() as unknown as Prisma.InputJsonValue,
          pageCount: crawlJob.pageCount,
          ...updateData,
        },
        update: updateData,
      })
    );
  }

  async incrementPageCount(crawlJobId: string): Promise<number> {
    // Called once per page, up to CRAWL_WORKER_CONCURRENCY at a time —
    // same single-connection contention risk as PrismaPageRepository.save().
    return sqliteWriteLock.runExclusive(async () => {
      const row = await this.client.crawlJob.update({
        where: { id: crawlJobId },
        data: { pageCount: { increment: 1 } },
      });
      return row.pageCount;
    });
  }

  async findById(id: string): Promise<CrawlJob | null> {
    const row = await this.client.crawlJob.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findActiveByProjectId(projectId: string): Promise<CrawlJob | null> {
    const row = await this.client.crawlJob.findFirst({
      where: { projectId, status: { in: ["PENDING", "RUNNING"] } },
      // createdAt, not startedAt — a PENDING job hasn't started yet, so
      // startedAt is still null and would sort unpredictably.
      orderBy: { createdAt: "desc" },
    });
    return row ? toDomain(row) : null;
  }

  async findLatestByProjectId(projectId: string): Promise<CrawlJob | null> {
    const row = await this.client.crawlJob.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return row ? toDomain(row) : null;
  }
}
