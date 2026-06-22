import type { PrismaClient, SchemaMarkup as PrismaSchemaMarkupRow, Prisma } from "@/generated/prisma/client";
import type { SchemaMarkupRepositoryPort } from "@/application/schema-markup/ports/schema-markup-repository-port";
import {
  SchemaMarkup,
  type SchemaMarkupSource,
  type SchemaMarkupStatus,
  type SchemaMarkupType,
} from "@/domain/schema-markup/entities/schema-markup";
import { sqliteWriteLock } from "@/shared/async-mutex";

function toDomain(row: PrismaSchemaMarkupRow): SchemaMarkup {
  return SchemaMarkup.reconstitute({
    id: row.id,
    pageId: row.pageId,
    type: row.type as SchemaMarkupType,
    jsonLd: row.jsonLd as Record<string, unknown>,
    source: row.source as SchemaMarkupSource,
    status: row.status as SchemaMarkupStatus,
    createdAt: row.createdAt,
  });
}

export class PrismaSchemaMarkupRepository implements SchemaMarkupRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  // Plain inserts, no upsert — every Page row belongs to exactly one crawl
  // job (fresh per crawl), so SchemaMarkup rows are already naturally
  // scoped per crawl job through their pageId and never need replacing.
  async saveMany(schemaMarkups: readonly SchemaMarkup[]): Promise<void> {
    if (schemaMarkups.length === 0) return;

    // Runs from CrawlJobCompleted — see AsyncMutex's doc comment.
    await sqliteWriteLock.runExclusive(() =>
      this.client.schemaMarkup.createMany({
        data: schemaMarkups.map((markup) => ({
          id: markup.id,
          pageId: markup.pageId,
          type: markup.type,
          jsonLd: markup.jsonLd as Prisma.InputJsonValue,
          source: markup.source,
          status: markup.status,
          createdAt: markup.createdAt,
        })),
      })
    );
  }

  async findAllByCrawlJobId(crawlJobId: string): Promise<SchemaMarkup[]> {
    const rows = await this.client.schemaMarkup.findMany({
      where: { page: { crawlJobId } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomain);
  }
}
