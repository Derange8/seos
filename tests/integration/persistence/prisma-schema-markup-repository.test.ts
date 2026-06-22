import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaSchemaMarkupRepository } from "@/infrastructure/persistence/prisma/prisma-schema-markup-repository";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { PrismaPageRepository } from "@/infrastructure/persistence/prisma/prisma-page-repository";
import { SchemaMarkup } from "@/domain/schema-markup/entities/schema-markup";
import { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";

function config(): CrawlConfig {
  const result = CrawlConfig.create({});
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("PrismaSchemaMarkupRepository", () => {
  const repository = new PrismaSchemaMarkupRepository(prisma);
  const crawlJobRepository = new PrismaCrawlJobRepository(prisma);
  const pageRepository = new PrismaPageRepository(prisma);
  let projectId: string;
  let crawlJobId: string;
  let pageId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Schema Markup Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;

    const crawlJob = CrawlJob.create(project.id, config());
    await crawlJobRepository.save(crawlJob);
    crawlJobId = crawlJob.id;

    const page = Page.create(crawlJobId, url("https://example.com/"), { statusCode: 200 });
    await pageRepository.save(project.id, page);
    pageId = page.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("persists and retrieves schema markup for a crawl job", async () => {
    const markup = SchemaMarkup.createRuleBased(pageId, "Organization", {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Acme Inc",
    });

    await repository.saveMany([markup]);
    const found = await repository.findAllByCrawlJobId(crawlJobId);

    expect(found).toHaveLength(1);
    expect(found[0]?.id).toBe(markup.id);
    expect(found[0]?.jsonLd).toMatchObject({ name: "Acme Inc" });
    expect(found[0]?.source).toBe("rule_based");
    expect(found[0]?.status).toBe("APPROVED");
  });

  it("returns an empty array for a crawl job with no schema markup", async () => {
    const found = await repository.findAllByCrawlJobId(crypto.randomUUID());
    expect(found).toEqual([]);
  });

  it("is a no-op when saving an empty array", async () => {
    await expect(repository.saveMany([])).resolves.toBeUndefined();
  });
});
