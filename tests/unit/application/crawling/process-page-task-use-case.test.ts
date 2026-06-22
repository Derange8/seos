import { describe, expect, it } from "vitest";
import { ProcessPageTaskUseCase } from "@/application/crawling/use-cases/process-page-task-use-case";
import { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";
import { Url } from "@/domain/crawling/value-objects/url";
import type { PageTask } from "@/application/crawling/ports/crawl-queue-port";
import { ok } from "@/shared/result";
import {
  FakeCrawlJobRepository,
  FakeCrawlQueuePort,
  FakeHtmlParser,
  FakePageFetcher,
  FakePageRenderer,
  FakePageRepository,
  FakeRateLimiter,
  FakeRobotsPort,
  SilentLogger,
  emptyParsedContent,
  fetchErr,
  fetchOk,
} from "./fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function config(overrides: Partial<{ maxDepth: number; maxPages: number; respectRobots: boolean }> = {}): CrawlConfig {
  const result = CrawlConfig.create(overrides);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function runningJob(overrides: Partial<{ maxDepth: number; maxPages: number; respectRobots: boolean }> = {}): CrawlJob {
  const job = CrawlJob.create("project-1", config(overrides));
  job.start();
  return job;
}

function task(crawlJobId: string, overrides: Partial<PageTask> = {}): PageTask {
  return {
    crawlJobId,
    url: url("https://example.com/"),
    depth: 0,
    discoveredFrom: null,
    ...overrides,
  };
}

describe("ProcessPageTaskUseCase", () => {
  it("does nothing when the crawl job cannot be found", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const pageRepository = new FakePageRepository();
    const queue = new FakeCrawlQueuePort();
    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(fetchOk({}, url("https://example.com/"))),
      renderer: new FakePageRenderer(fetchOk({}, url("https://example.com/"))),
      htmlParser: new FakeHtmlParser(emptyParsedContent()),
      crawlJobRepository,
      pageRepository,
      queue,
      robots: new FakeRobotsPort(),
      rateLimiter: new FakeRateLimiter(),
      logger: new SilentLogger(),
    });

    await useCase.execute(task("missing-job"));

    expect(pageRepository.saved).toHaveLength(0);
    expect(queue.enqueued).toHaveLength(0);
  });

  it("does nothing when the crawl job is not RUNNING", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = CrawlJob.create("project-1", config()); // still PENDING
    crawlJobRepository.seed(job);
    const pageRepository = new FakePageRepository();
    const queue = new FakeCrawlQueuePort();
    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(fetchOk({}, url("https://example.com/"))),
      renderer: new FakePageRenderer(fetchOk({}, url("https://example.com/"))),
      htmlParser: new FakeHtmlParser(emptyParsedContent()),
      crawlJobRepository,
      pageRepository,
      queue,
      robots: new FakeRobotsPort(),
      rateLimiter: new FakeRateLimiter(),
      logger: new SilentLogger(),
    });

    await useCase.execute(task(job.id));

    expect(pageRepository.saved).toHaveLength(0);
  });

  it("persists nothing when the fetch fails", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = runningJob();
    crawlJobRepository.seed(job);
    const pageRepository = new FakePageRepository();
    const queue = new FakeCrawlQueuePort();
    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(fetchErr("TIMEOUT")),
      renderer: new FakePageRenderer(fetchErr("TIMEOUT")),
      htmlParser: new FakeHtmlParser(emptyParsedContent()),
      crawlJobRepository,
      pageRepository,
      queue,
      robots: new FakeRobotsPort(),
      rateLimiter: new FakeRateLimiter(),
      logger: new SilentLogger(),
    });

    await useCase.execute(task(job.id));

    expect(pageRepository.saved).toHaveLength(0);
    expect(queue.enqueued).toHaveLength(0);
  });

  it("persists the page, updates the crawl job, and enqueues internal links within maxDepth", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = runningJob({ maxDepth: 1 });
    crawlJobRepository.seed(job);
    const pageRepository = new FakePageRepository();
    const queue = new FakeCrawlQueuePort();

    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(fetchOk({ statusCode: 200 }, url("https://example.com/"))),
      renderer: new FakePageRenderer(fetchErr("TIMEOUT")),
      htmlParser: new FakeHtmlParser(
        emptyParsedContent({
          title: "Home",
          links: ["https://example.com/about", "https://other.com/"],
        })
      ),
      crawlJobRepository,
      pageRepository,
      queue,
      robots: new FakeRobotsPort(),
      rateLimiter: new FakeRateLimiter(),
      logger: new SilentLogger(),
    });

    await useCase.execute(task(job.id, { depth: 0 }));

    expect(pageRepository.saved).toHaveLength(1);
    expect(pageRepository.saved[0]?.page.title).toBe("Home");
    expect(pageRepository.saved[0]?.page.allLinks).toHaveLength(2);
    expect(pageRepository.saved[0]?.page.responseTimeMs).toBe(10);
    expect(pageRepository.saved[0]?.page.hasStructuredData).toBe(false);
    expect(pageRepository.saved[0]?.page.imagesMissingAltCount).toBe(0);
    expect(pageRepository.saved[0]?.page.redirectChain).toEqual([]);
    expect(pageRepository.saved[0]?.page.mixedContentCount).toBe(0);
    expect(pageRepository.saved[0]?.page.h1Count).toBe(0);
    expect(pageRepository.saved[0]?.page.canonicalTagCount).toBe(0);
    expect(pageRepository.saved[0]?.page.isNoindex).toBe(false);

    expect(job.pageCount).toBe(1);
    expect(crawlJobRepository.saved).toHaveLength(0);
    expect(crawlJobRepository.pageCountIncrements).toEqual([job.id]);

    // Only the internal link is enqueued; the external one is recorded as a
    // Link but not traversed (Crawler Engine design §2).
    expect(queue.enqueued).toHaveLength(1);
    expect(queue.enqueued[0]?.url.href).toBe("https://example.com/about");
    expect(queue.enqueued[0]?.depth).toBe(1);
  });

  it("persists the fetcher's redirect chain on the page", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = runningJob({ maxDepth: 1 });
    crawlJobRepository.seed(job);
    const pageRepository = new FakePageRepository();

    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(
        fetchOk({ statusCode: 200, redirectChain: ["https://example.com/a", "https://example.com/b"] }, url("https://example.com/"))
      ),
      renderer: new FakePageRenderer(fetchErr("TIMEOUT")),
      htmlParser: new FakeHtmlParser(emptyParsedContent({ title: "Home" })),
      crawlJobRepository,
      pageRepository,
      queue: new FakeCrawlQueuePort(),
      robots: new FakeRobotsPort(),
      rateLimiter: new FakeRateLimiter(),
      logger: new SilentLogger(),
    });

    await useCase.execute(task(job.id, { depth: 0 }));

    expect(pageRepository.saved[0]?.page.redirectChain).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("persists the parser's h1Count, canonicalTagCount, and isNoindex on the page", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = runningJob({ maxDepth: 1 });
    crawlJobRepository.seed(job);
    const pageRepository = new FakePageRepository();

    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(fetchOk({ statusCode: 200 }, url("https://example.com/"))),
      renderer: new FakePageRenderer(fetchErr("TIMEOUT")),
      htmlParser: new FakeHtmlParser(
        emptyParsedContent({ title: "Home", h1Count: 2, canonicalTagCount: 2, isNoindex: true })
      ),
      crawlJobRepository,
      pageRepository,
      queue: new FakeCrawlQueuePort(),
      robots: new FakeRobotsPort(),
      rateLimiter: new FakeRateLimiter(),
      logger: new SilentLogger(),
    });

    await useCase.execute(task(job.id, { depth: 0 }));

    expect(pageRepository.saved[0]?.page.h1Count).toBe(2);
    expect(pageRepository.saved[0]?.page.canonicalTagCount).toBe(2);
    expect(pageRepository.saved[0]?.page.isNoindex).toBe(true);
  });

  it("does not enqueue Cloudflare's /cdn-cgi/ infrastructure links (e.g. the email-protection decoder)", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = runningJob({ maxDepth: 1 });
    crawlJobRepository.seed(job);
    const pageRepository = new FakePageRepository();
    const queue = new FakeCrawlQueuePort();

    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(fetchOk({}, url("https://example.com/"))),
      renderer: new FakePageRenderer(fetchErr("TIMEOUT")),
      htmlParser: new FakeHtmlParser(
        emptyParsedContent({
          links: ["https://example.com/cdn-cgi/l/email-protection", "https://example.com/about"],
        })
      ),
      crawlJobRepository,
      pageRepository,
      queue,
      robots: new FakeRobotsPort(),
      rateLimiter: new FakeRateLimiter(),
      logger: new SilentLogger(),
    });

    await useCase.execute(task(job.id, { depth: 0 }));

    expect(queue.enqueued).toHaveLength(1);
    expect(queue.enqueued[0]?.url.href).toBe("https://example.com/about");
  });

  it("does not enqueue links beyond maxDepth", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = runningJob({ maxDepth: 0 });
    crawlJobRepository.seed(job);
    const pageRepository = new FakePageRepository();
    const queue = new FakeCrawlQueuePort();

    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(fetchOk({}, url("https://example.com/"))),
      renderer: new FakePageRenderer(fetchErr("TIMEOUT")),
      htmlParser: new FakeHtmlParser(
        emptyParsedContent({ links: ["https://example.com/too-deep"] })
      ),
      crawlJobRepository,
      pageRepository,
      queue,
      robots: new FakeRobotsPort(),
      rateLimiter: new FakeRateLimiter(),
      logger: new SilentLogger(),
    });

    await useCase.execute(task(job.id, { depth: 0 }));

    expect(queue.enqueued).toHaveLength(0);
  });

  it("still saves the page but enqueues nothing once the page limit is reached", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const baseJob = runningJob({ maxPages: 1, maxDepth: 5 });

    // Rehydrate at pageCount === maxPages, simulating a job that already hit
    // its limit before this task is processed.
    const limitJob = CrawlJob.reconstitute({
      id: baseJob.id,
      projectId: baseJob.projectId,
      config: baseJob.config,
      status: "RUNNING",
      pageCount: 1,
      startedAt: new Date(),
      finishedAt: null,
      error: null,
    });
    crawlJobRepository.seed(limitJob);

    const pageRepository = new FakePageRepository();
    const queue = new FakeCrawlQueuePort();

    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(fetchOk({}, url("https://example.com/"))),
      renderer: new FakePageRenderer(fetchErr("TIMEOUT")),
      htmlParser: new FakeHtmlParser(
        emptyParsedContent({ links: ["https://example.com/another"] })
      ),
      crawlJobRepository,
      pageRepository,
      queue,
      robots: new FakeRobotsPort(),
      rateLimiter: new FakeRateLimiter(),
      logger: new SilentLogger(),
    });

    await useCase.execute(task(limitJob.id));

    expect(pageRepository.saved).toHaveLength(1);
    expect(queue.enqueued).toHaveLength(0);
    expect(crawlJobRepository.pageCountIncrements).toHaveLength(0);
  });

  it("falls back to the renderer when the JS-rendering heuristic flags the fetched HTML", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = runningJob();
    crawlJobRepository.seed(job);
    const pageRepository = new FakePageRepository();
    const queue = new FakeCrawlQueuePort();

    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(
        fetchOk({ statusCode: 200, html: '<html><body><div id="root"></div></body></html>' }, url("https://example.com/"))
      ),
      renderer: new FakePageRenderer(
        fetchOk(
          { statusCode: 200, html: "<html><body><p>rendered content</p></body></html>", renderMode: "PLAYWRIGHT" },
          url("https://example.com/")
        )
      ),
      htmlParser: new FakeHtmlParser(emptyParsedContent({ title: "Rendered Title" })),
      crawlJobRepository,
      pageRepository,
      queue,
      robots: new FakeRobotsPort(),
      rateLimiter: new FakeRateLimiter(),
      logger: new SilentLogger(),
    });

    await useCase.execute(task(job.id));

    expect(pageRepository.saved).toHaveLength(1);
    expect(pageRepository.saved[0]?.page.title).toBe("Rendered Title");
  });

  it("skips a page disallowed by robots.txt when respectRobots is on", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = runningJob({ respectRobots: true });
    crawlJobRepository.seed(job);
    const pageRepository = new FakePageRepository();
    const queue = new FakeCrawlQueuePort();
    const fetcher = new FakePageFetcher(fetchOk({}, url("https://example.com/admin/")));

    const useCase = new ProcessPageTaskUseCase({
      fetcher,
      renderer: new FakePageRenderer(fetchErr("TIMEOUT")),
      htmlParser: new FakeHtmlParser(emptyParsedContent()),
      crawlJobRepository,
      pageRepository,
      queue,
      robots: new FakeRobotsPort(ok("User-agent: *\nDisallow: /admin/")),
      rateLimiter: new FakeRateLimiter(),
      logger: new SilentLogger(),
    });

    await useCase.execute(task(job.id, { url: url("https://example.com/admin/") }));

    expect(pageRepository.saved).toHaveLength(0);
  });

  it("still fetches a disallowed page when respectRobots is off", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = runningJob({ respectRobots: false });
    crawlJobRepository.seed(job);
    const pageRepository = new FakePageRepository();
    const queue = new FakeCrawlQueuePort();

    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(fetchOk({}, url("https://example.com/admin/"))),
      renderer: new FakePageRenderer(fetchErr("TIMEOUT")),
      htmlParser: new FakeHtmlParser(emptyParsedContent()),
      crawlJobRepository,
      pageRepository,
      queue,
      robots: new FakeRobotsPort(ok("User-agent: *\nDisallow: /admin/")),
      rateLimiter: new FakeRateLimiter(),
      logger: new SilentLogger(),
    });

    await useCase.execute(task(job.id, { url: url("https://example.com/admin/") }));

    expect(pageRepository.saved).toHaveLength(1);
  });

  it("waits for its turn on the rate limiter before fetching, using the default interval with no Crawl-delay", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = runningJob({ respectRobots: true });
    crawlJobRepository.seed(job);
    const pageRepository = new FakePageRepository();
    const queue = new FakeCrawlQueuePort();
    const rateLimiter = new FakeRateLimiter();

    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(fetchOk({}, url("https://example.com/"))),
      renderer: new FakePageRenderer(fetchErr("TIMEOUT")),
      htmlParser: new FakeHtmlParser(emptyParsedContent()),
      crawlJobRepository,
      pageRepository,
      queue,
      robots: new FakeRobotsPort(ok("User-agent: *\nDisallow: /admin/")),
      rateLimiter,
      logger: new SilentLogger(),
    });

    await useCase.execute(task(job.id));

    expect(rateLimiter.calls).toEqual([{ origin: "https://example.com", minIntervalMs: 500 }]);
  });

  it("uses the site's own Crawl-delay as the rate-limit interval when respectRobots is on", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = runningJob({ respectRobots: true });
    crawlJobRepository.seed(job);
    const pageRepository = new FakePageRepository();
    const queue = new FakeCrawlQueuePort();
    const rateLimiter = new FakeRateLimiter();

    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(fetchOk({}, url("https://example.com/"))),
      renderer: new FakePageRenderer(fetchErr("TIMEOUT")),
      htmlParser: new FakeHtmlParser(emptyParsedContent()),
      crawlJobRepository,
      pageRepository,
      queue,
      robots: new FakeRobotsPort(ok("User-agent: *\nCrawl-delay: 5")),
      rateLimiter,
      logger: new SilentLogger(),
    });

    await useCase.execute(task(job.id));

    expect(rateLimiter.calls).toEqual([{ origin: "https://example.com", minIntervalMs: 5000 }]);
  });

  it("caps an extreme Crawl-delay instead of respecting it outright", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = runningJob({ respectRobots: true });
    crawlJobRepository.seed(job);
    const pageRepository = new FakePageRepository();
    const queue = new FakeCrawlQueuePort();
    const rateLimiter = new FakeRateLimiter();

    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(fetchOk({}, url("https://example.com/"))),
      renderer: new FakePageRenderer(fetchErr("TIMEOUT")),
      htmlParser: new FakeHtmlParser(emptyParsedContent()),
      crawlJobRepository,
      pageRepository,
      queue,
      robots: new FakeRobotsPort(ok("User-agent: *\nCrawl-delay: 3600")),
      rateLimiter,
      logger: new SilentLogger(),
    });

    await useCase.execute(task(job.id));

    expect(rateLimiter.calls).toEqual([{ origin: "https://example.com", minIntervalMs: 60_000 }]);
  });

  it("fetches robots.txt only once per crawl job across multiple tasks", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = runningJob({ respectRobots: true });
    crawlJobRepository.seed(job);
    const pageRepository = new FakePageRepository();
    const queue = new FakeCrawlQueuePort();
    const robots = new FakeRobotsPort();

    const useCase = new ProcessPageTaskUseCase({
      fetcher: new FakePageFetcher(fetchOk({}, url("https://example.com/"))),
      renderer: new FakePageRenderer(fetchErr("TIMEOUT")),
      htmlParser: new FakeHtmlParser(emptyParsedContent()),
      crawlJobRepository,
      pageRepository,
      queue,
      robots,
      rateLimiter: new FakeRateLimiter(),
      logger: new SilentLogger(),
    });

    await useCase.execute(task(job.id, { url: url("https://example.com/a") }));
    await useCase.execute(task(job.id, { url: url("https://example.com/b") }));

    expect(robots.fetchCount).toBe(1);
  });
});
