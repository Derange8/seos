import type {
  PrismaClient,
  Page as PrismaPageRow,
  Link as PrismaLinkRow,
} from "@/generated/prisma/client";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import { Page, type Faq, type PageProps } from "@/domain/crawling/entities/page";
import { Link } from "@/domain/crawling/entities/link";
import { Url } from "@/domain/crawling/value-objects/url";
import { sqliteWriteLock } from "@/shared/async-mutex";

function toDomainUrl(raw: string, context: string): Url {
  const result = Url.create(raw);
  if (!result.ok) {
    throw new Error(`${context} has a corrupt persisted URL "${raw}": ${result.error.message}`);
  }
  return result.value;
}

// The faqs column is a plain JSON value, not type-checked by the DB —
// defensively coerce rather than trust the shape blindly.
function toDomainFaqs(raw: unknown): Faq[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is Faq =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).question === "string" &&
      typeof (entry as Record<string, unknown>).answer === "string"
  );
}

// Same defensive coercion as toDomainFaqs — redirectChain is also a plain
// JSON column.
function toDomainRedirectChain(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === "string");
}

// Same defensive coercion again — externalScriptOrigins is also a plain
// JSON column.
function toDomainExternalScriptOrigins(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === "string");
}

// Same defensive coercion again — structuredDataTypes is also a plain
// JSON column.
function toDomainStructuredDataTypes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is string => typeof entry === "string");
}

function toDomain(row: PrismaPageRow & { links: PrismaLinkRow[] }): Page {
  const props: PageProps = {
    id: row.id,
    crawlJobId: row.crawlJobId,
    url: toDomainUrl(row.url, `Page "${row.id}"`),
    crawledAt: row.crawledAt,
    statusCode: row.statusCode,
    title: row.title,
    metaDescription: row.metaDescription,
    h1: row.h1,
    canonicalUrl: row.canonicalUrl,
    contentHash: row.contentHash,
    wordCount: row.wordCount,
    contentExcerpt: row.contentExcerpt,
    faqs: toDomainFaqs(row.faqs),
    responseTimeMs: row.responseTimeMs,
    hasStructuredData: row.hasStructuredData,
    structuredDataTypes: toDomainStructuredDataTypes(row.structuredDataTypes),
    hasInvalidStructuredData: row.hasInvalidStructuredData,
    imagesMissingAltCount: row.imagesMissingAltCount,
    redirectChain: toDomainRedirectChain(row.redirectChain),
    mixedContentCount: row.mixedContentCount,
    hasDuplicateTitle: row.hasDuplicateTitle,
    hasDuplicateMetaDescription: row.hasDuplicateMetaDescription,
    hasDuplicateContent: row.hasDuplicateContent,
    h1Count: row.h1Count,
    canonicalTagCount: row.canonicalTagCount,
    isNoindex: row.isNoindex,
    isOrphan: row.isOrphan,
    cspHeader: row.cspHeader,
    externalScriptOrigins: toDomainExternalScriptOrigins(row.externalScriptOrigins),
    rawWordCount: row.rawWordCount,
    isClientSideOnlyContent: row.isClientSideOnlyContent,
  };

  const links = row.links.map((linkRow) =>
    Link.reconstitute({
      id: linkRow.id,
      pageId: linkRow.pageId,
      targetUrl: toDomainUrl(linkRow.targetUrl, `Link "${linkRow.id}"`),
      isInternal: linkRow.isInternal,
      isBroken: linkRow.isBroken,
    })
  );

  return Page.reconstitute(props, links);
}

export class PrismaPageRepository implements PageRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async save(projectId: string, page: Page): Promise<void> {
    const data = {
      statusCode: page.statusCode,
      title: page.title,
      metaDescription: page.metaDescription,
      h1: page.h1,
      canonicalUrl: page.canonicalUrl,
      contentHash: page.contentHash,
      wordCount: page.wordCount,
      contentExcerpt: page.contentExcerpt,
      faqs: page.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
      responseTimeMs: page.responseTimeMs,
      hasStructuredData: page.hasStructuredData,
      structuredDataTypes: page.structuredDataTypes,
      hasInvalidStructuredData: page.hasInvalidStructuredData,
      imagesMissingAltCount: page.imagesMissingAltCount,
      redirectChain: page.redirectChain,
      mixedContentCount: page.mixedContentCount,
      hasDuplicateTitle: page.hasDuplicateTitle,
      hasDuplicateMetaDescription: page.hasDuplicateMetaDescription,
      hasDuplicateContent: page.hasDuplicateContent,
      h1Count: page.h1Count,
      canonicalTagCount: page.canonicalTagCount,
      isNoindex: page.isNoindex,
      isOrphan: page.isOrphan,
      cspHeader: page.cspHeader,
      externalScriptOrigins: page.externalScriptOrigins,
      rawWordCount: page.rawWordCount,
      isClientSideOnlyContent: page.isClientSideOnlyContent,
      crawledAt: page.crawledAt,
    };

    // Crawled pages save concurrently (CRAWL_WORKER_CONCURRENCY), but
    // better-sqlite3 is one synchronous connection — without serializing
    // these, two overlapping $transaction() calls can interleave their
    // BEGIN/COMMIT on that single connection and silently lose one's
    // writes. See AsyncMutex's doc comment.
    await sqliteWriteLock.runExclusive(() =>
      this.client.$transaction(async (tx) => {
        const row = await tx.page.upsert({
          where: { crawlJobId_url: { crawlJobId: page.crawlJobId, url: page.url.href } },
          create: {
            id: page.id,
            projectId,
            crawlJobId: page.crawlJobId,
            url: page.url.href,
            ...data,
          },
          update: data,
        });

        // Replace links wholesale on every save — idempotent for retries,
        // and outbound links can legitimately change between fetch attempts.
        await tx.link.deleteMany({ where: { pageId: row.id } });
        if (page.allLinks.length > 0) {
          await tx.link.createMany({
            data: page.allLinks.map((link) => ({
              pageId: row.id,
              targetUrl: link.targetUrl.href,
              isInternal: link.isInternal,
              isBroken: link.isBroken,
            })),
          });
        }
      })
    );
  }

  async findById(id: string): Promise<Page | null> {
    const row = await this.client.page.findUnique({
      where: { id },
      include: { links: true },
    });
    return row ? toDomain(row) : null;
  }

  async findByCrawlJobAndUrl(crawlJobId: string, url: string): Promise<Page | null> {
    const row = await this.client.page.findUnique({
      where: { crawlJobId_url: { crawlJobId, url } },
      include: { links: true },
    });
    return row ? toDomain(row) : null;
  }

  async findAllByCrawlJobId(crawlJobId: string): Promise<Page[]> {
    const rows = await this.client.page.findMany({
      where: { crawlJobId },
      include: { links: true },
      orderBy: { crawledAt: "asc" },
    });
    return rows.map(toDomain);
  }

  async countByCrawlJobId(crawlJobId: string): Promise<number> {
    return this.client.page.count({ where: { crawlJobId } });
  }
}
