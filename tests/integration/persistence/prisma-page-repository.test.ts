import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { PrismaPageRepository } from "@/infrastructure/persistence/prisma/prisma-page-repository";
import { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";
import { Page } from "@/domain/crawling/entities/page";
import { Link } from "@/domain/crawling/entities/link";
import { Url } from "@/domain/crawling/value-objects/url";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function config(): CrawlConfig {
  const result = CrawlConfig.create();
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("PrismaPageRepository", () => {
  const pageRepository = new PrismaPageRepository(prisma);
  const crawlJobRepository = new PrismaCrawlJobRepository(prisma);
  let projectId: string;
  let crawlJobId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: {
        name: "Integration Test Project (pages)",
        domain: `itest-pages-${crypto.randomUUID()}.example.com`,
      },
    });
    projectId = project.id;

    const job = CrawlJob.create(projectId, config());
    await crawlJobRepository.save(job);
    crawlJobId = job.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("round-trips a page with its links", async () => {
    const page = Page.create(crawlJobId, url("https://example.com/about"), {
      statusCode: 200,
      title: "About us",
      wordCount: 120,
    });
    page.addLink(Link.create(page.id, page.url, url("https://example.com/contact")));
    page.addLink(Link.create(page.id, page.url, url("https://other.com/")));

    await pageRepository.save(projectId, page);
    const found = await pageRepository.findByCrawlJobAndUrl(crawlJobId, page.url.href);

    expect(found).not.toBeNull();
    expect(found?.title).toBe("About us");
    expect(found?.statusCode).toBe(200);
    expect(found?.wordCount).toBe(120);
    expect(found?.allLinks).toHaveLength(2);
    expect(found?.allLinks.some((l) => l.isInternal)).toBe(true);
    expect(found?.allLinks.some((l) => !l.isInternal)).toBe(true);
  });

  it("round-trips a page's responseTimeMs and hasStructuredData", async () => {
    const page = Page.create(crawlJobId, url("https://example.com/perf"), {
      statusCode: 200,
      responseTimeMs: 2345,
      hasStructuredData: true,
    });

    await pageRepository.save(projectId, page);
    const found = await pageRepository.findByCrawlJobAndUrl(crawlJobId, page.url.href);

    expect(found?.responseTimeMs).toBe(2345);
    expect(found?.hasStructuredData).toBe(true);
  });

  it("round-trips a page's imagesMissingAltCount", async () => {
    const page = Page.create(crawlJobId, url("https://example.com/gallery"), {
      statusCode: 200,
      imagesMissingAltCount: 4,
    });

    await pageRepository.save(projectId, page);
    const found = await pageRepository.findByCrawlJobAndUrl(crawlJobId, page.url.href);

    expect(found?.imagesMissingAltCount).toBe(4);
  });

  it("round-trips a page's redirectChain and mixedContentCount", async () => {
    const page = Page.create(crawlJobId, url("https://example.com/redirected"), {
      statusCode: 200,
      redirectChain: ["https://example.com/old", "https://example.com/older"],
      mixedContentCount: 3,
    });

    await pageRepository.save(projectId, page);
    const found = await pageRepository.findByCrawlJobAndUrl(crawlJobId, page.url.href);

    expect(found?.redirectChain).toEqual(["https://example.com/old", "https://example.com/older"]);
    expect(found?.mixedContentCount).toBe(3);
  });

  it("round-trips a page's hasDuplicateTitle, hasDuplicateMetaDescription, and hasDuplicateContent", async () => {
    const page = Page.create(crawlJobId, url("https://example.com/dup"), { statusCode: 200 });
    page.setDuplicateFlags(true, true, true);

    await pageRepository.save(projectId, page);
    const found = await pageRepository.findByCrawlJobAndUrl(crawlJobId, page.url.href);

    expect(found?.hasDuplicateTitle).toBe(true);
    expect(found?.hasDuplicateMetaDescription).toBe(true);
    expect(found?.hasDuplicateContent).toBe(true);
  });

  it("round-trips a page's h1Count, canonicalTagCount, and isNoindex", async () => {
    const page = Page.create(crawlJobId, url("https://example.com/multi"), {
      statusCode: 200,
      h1Count: 2,
      canonicalTagCount: 3,
      isNoindex: true,
    });

    await pageRepository.save(projectId, page);
    const found = await pageRepository.findByCrawlJobAndUrl(crawlJobId, page.url.href);

    expect(found?.h1Count).toBe(2);
    expect(found?.canonicalTagCount).toBe(3);
    expect(found?.isNoindex).toBe(true);
  });

  it("round-trips a page's isOrphan", async () => {
    const page = Page.create(crawlJobId, url("https://example.com/orphan"), { statusCode: 200 });
    page.setOrphan(true);

    await pageRepository.save(projectId, page);
    const found = await pageRepository.findByCrawlJobAndUrl(crawlJobId, page.url.href);

    expect(found?.isOrphan).toBe(true);
  });

  it("round-trips a page's faqs", async () => {
    const faqs = [
      { question: "What is this page about?", answer: "It's a test fixture." },
      { question: "Is it real content?", answer: "No, just for testing." },
    ];
    const page = Page.create(crawlJobId, url("https://example.com/faq"), { statusCode: 200, faqs });

    await pageRepository.save(projectId, page);
    const found = await pageRepository.findByCrawlJobAndUrl(crawlJobId, page.url.href);

    expect(found?.faqs).toEqual(faqs);
  });

  it("upserts on (crawlJobId, url) and replaces links rather than duplicating", async () => {
    const targetUrl = url("https://example.com/pricing");
    const first = Page.create(crawlJobId, targetUrl, { title: "Pricing v1" });
    first.addLink(Link.create(first.id, first.url, url("https://example.com/a")));
    await pageRepository.save(projectId, first);

    // Simulate a retry: a fresh Page instance (new domain id) for the same
    // (crawlJobId, url) — must overwrite, not create a second row.
    const retry = Page.create(crawlJobId, targetUrl, { title: "Pricing v2" });
    retry.addLink(Link.create(retry.id, retry.url, url("https://example.com/b")));
    retry.addLink(Link.create(retry.id, retry.url, url("https://example.com/c")));
    await pageRepository.save(projectId, retry);

    const found = await pageRepository.findByCrawlJobAndUrl(crawlJobId, targetUrl.href);
    expect(found?.title).toBe("Pricing v2");
    expect(found?.allLinks).toHaveLength(2);

    const rowCount = await prisma.page.count({
      where: { crawlJobId, url: targetUrl.href },
    });
    expect(rowCount).toBe(1);
  });

  it("countByCrawlJobId reflects the number of saved pages", async () => {
    const countBefore = await pageRepository.countByCrawlJobId(crawlJobId);
    const page = Page.create(crawlJobId, url("https://example.com/new-unique-page"));
    await pageRepository.save(projectId, page);
    const countAfter = await pageRepository.countByCrawlJobId(crawlJobId);
    expect(countAfter).toBe(countBefore + 1);
  });

  it("returns null when no page matches", async () => {
    const found = await pageRepository.findByCrawlJobAndUrl(crawlJobId, "https://example.com/missing");
    expect(found).toBeNull();
  });

  it("findAllByCrawlJobId returns every page saved for that job", async () => {
    const isolatedJob = CrawlJob.create(projectId, config());
    await crawlJobRepository.save(isolatedJob);

    await pageRepository.save(projectId, Page.create(isolatedJob.id, url("https://example.com/list-a")));
    await pageRepository.save(projectId, Page.create(isolatedJob.id, url("https://example.com/list-b")));

    const pages = await pageRepository.findAllByCrawlJobId(isolatedJob.id);
    expect(pages.map((p) => p.url.href).sort()).toEqual([
      "https://example.com/list-a",
      "https://example.com/list-b",
    ]);
  });
});
