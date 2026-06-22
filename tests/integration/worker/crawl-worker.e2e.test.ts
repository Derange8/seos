import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { PrismaPageRepository } from "@/infrastructure/persistence/prisma/prisma-page-repository";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { PrismaSchemaMarkupRepository } from "@/infrastructure/persistence/prisma/prisma-schema-markup-repository";
import { createCrawlPipeline } from "@/infrastructure/pipeline/crawl-pipeline";
import { StartCrawlUseCase } from "@/application/crawling/use-cases/start-crawl-use-case";
import { Url } from "@/domain/crawling/value-objects/url";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

async function startSite(): Promise<{ origin: string; close: () => Promise<void> }> {
  const pages: Record<string, string> = {
    "/": `<html><head><title>Home</title></head><body><h1>Home</h1>
      <a href="/about">About</a> <a href="/contact">Contact</a></body></html>`,
    "/about": `<html><head><title>About</title></head><body><h1>About</h1>
      <a href="/">Home</a> <a href="/contact">Contact</a></body></html>`,
    "/contact": `<html><head><title>Contact</title></head><body><h1>Contact</h1></body></html>`,
    // Not linked from any other page on purpose — only the FAQ-schema test
    // below crawls it directly (as its own crawl root), so it never
    // affects the page-count assertion in the link-following test above.
    "/faq": `<html><head><title>FAQ</title></head><body><h1>FAQ</h1>
      <h2>What is Seos?</h2><p>Seos is an AI SEO platform.</p>
      <h2>Is there a free plan?</h2><p>Yes, for one project.</p></body></html>`,
  };

  const server = http.createServer((req, res) => {
    const body = pages[req.url ?? "/"];
    if (!body) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(body);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs: number, intervalMs = 150): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`waitUntil() timed out after ${timeoutMs}ms`);
}

describe("crawl pipeline (end-to-end)", () => {
  let site: { origin: string; close: () => Promise<void> };
  let projectId: string;

  const crawlJobRepository = new PrismaCrawlJobRepository(prisma);
  const pageRepository = new PrismaPageRepository(prisma);
  const projectRepository = new PrismaProjectRepository(prisma);
  const schemaMarkupRepository = new PrismaSchemaMarkupRepository(prisma);
  // A dedicated pipeline instance, isolated from the app-wide singleton —
  // allowPrivateNetworks: true since this test crawls a real local HTTP
  // server (127.0.0.1), which the SSRF guard blocks by default on purpose;
  // see private-network-guard.ts.
  const { crawlQueue: queue } = createCrawlPipeline({ allowPrivateNetworks: true, crawlConcurrency: 2 });
  const startCrawl = new StartCrawlUseCase({ crawlJobRepository, projectRepository, queue });

  beforeAll(async () => {
    site = await startSite();

    const project = await prisma.project.create({
      data: {
        name: "E2E Pipeline Test Project",
        domain: `e2e-${crypto.randomUUID()}.example.com`,
        // Domain verification is a separate concern (VerifyDomainUseCase);
        // this test is about crawling, so the project starts pre-verified.
        domainVerifiedAt: new Date(),
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await site.close();
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("crawls every page reachable from the root and marks the job COMPLETED", async () => {
    const startResult = await startCrawl.execute(projectId, url(site.origin), {
      maxDepth: 2,
      maxPages: 10,
      concurrency: 2,
    });
    expect(startResult.ok).toBe(true);
    if (!startResult.ok) return;

    const crawlJobId = startResult.value.id;

    await waitUntil(
      async () => {
        const job = await crawlJobRepository.findById(crawlJobId);
        return job?.status === "COMPLETED" || job?.status === "FAILED";
      },
      20000
    );

    const finishedJob = await crawlJobRepository.findById(crawlJobId);
    expect(finishedJob?.status).toBe("COMPLETED");
    expect(finishedJob?.pageCount).toBe(3);

    const home = await pageRepository.findByCrawlJobAndUrl(crawlJobId, `${site.origin}/`);
    const about = await pageRepository.findByCrawlJobAndUrl(crawlJobId, `${site.origin}/about`);
    const contact = await pageRepository.findByCrawlJobAndUrl(crawlJobId, `${site.origin}/contact`);

    expect(home?.title).toBe("Home");
    expect(about?.title).toBe("About");
    expect(contact?.title).toBe("Contact");
    expect(home?.allLinks.map((l) => l.targetUrl.href).sort()).toEqual(
      [`${site.origin}/about`, `${site.origin}/contact`].sort()
    );
  }, 30000);

  it("generates an FAQPage schema markup block from heading-derived Q&A content", async () => {
    const startResult = await startCrawl.execute(projectId, url(`${site.origin}/faq`), {
      maxDepth: 0,
      maxPages: 5,
      concurrency: 1,
    });
    expect(startResult.ok).toBe(true);
    if (!startResult.ok) return;

    const crawlJobId = startResult.value.id;

    await waitUntil(
      async () => {
        const job = await crawlJobRepository.findById(crawlJobId);
        return job?.status === "COMPLETED" || job?.status === "FAILED";
      },
      20000
    );

    const finishedJob = await crawlJobRepository.findById(crawlJobId);
    expect(finishedJob?.status).toBe("COMPLETED");

    const faqPage = await pageRepository.findByCrawlJobAndUrl(crawlJobId, `${site.origin}/faq`);
    expect(faqPage?.faqs).toEqual([
      { question: "What is Seos?", answer: "Seos is an AI SEO platform." },
      { question: "Is there a free plan?", answer: "Yes, for one project." },
    ]);

    await waitUntil(async () => {
      const markup = await schemaMarkupRepository.findAllByCrawlJobId(crawlJobId);
      return markup.some((m) => m.type === "FAQPage");
    }, 10000);

    const markup = await schemaMarkupRepository.findAllByCrawlJobId(crawlJobId);
    const faqSchema = markup.find((m) => m.type === "FAQPage");
    expect(faqSchema?.jsonLd).toMatchObject({
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "What is Seos?" },
        { "@type": "Question", name: "Is there a free plan?" },
      ],
    });
  }, 30000);
});
