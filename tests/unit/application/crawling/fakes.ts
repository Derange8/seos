import type { CrawlJobRepositoryPort } from "@/application/crawling/ports/crawl-job-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import type { CrawlQueuePort, PageTask } from "@/application/crawling/ports/crawl-queue-port";
import type { PageFetcherPort } from "@/application/crawling/ports/page-fetcher-port";
import type { PageRendererPort } from "@/application/crawling/ports/page-renderer-port";
import type { HtmlParserPort, ParsedPageContent } from "@/application/crawling/ports/html-parser-port";
import { PageFetchError, type PageFetchResult } from "@/application/crawling/ports/page-fetch-result";
import type { RobotsPort } from "@/application/crawling/ports/robots-port";
import type { RateLimiterPort } from "@/application/crawling/ports/rate-limiter-port";
import type { Url } from "@/domain/crawling/value-objects/url";
import type { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import type { Page } from "@/domain/crawling/entities/page";
import type { Logger, LogContext } from "@/shared/logger";
import { ok, err, type Result } from "@/shared/result";

export class FakeCrawlJobRepository implements CrawlJobRepositoryPort {
  readonly saved: CrawlJob[] = [];
  readonly pageCountIncrements: string[] = [];
  private readonly byId = new Map<string, CrawlJob>();

  seed(crawlJob: CrawlJob): void {
    this.byId.set(crawlJob.id, crawlJob);
  }

  async save(crawlJob: CrawlJob): Promise<void> {
    this.byId.set(crawlJob.id, crawlJob);
    this.saved.push(crawlJob);
  }

  async incrementPageCount(crawlJobId: string): Promise<number> {
    this.pageCountIncrements.push(crawlJobId);
    return this.byId.get(crawlJobId)?.pageCount ?? 0;
  }

  async findById(id: string): Promise<CrawlJob | null> {
    return this.byId.get(id) ?? null;
  }

  async findActiveByProjectId(projectId: string): Promise<CrawlJob | null> {
    const active = [...this.byId.values()].find(
      (job) => job.projectId === projectId && (job.status === "PENDING" || job.status === "RUNNING")
    );
    return active ?? null;
  }

  async findLatestByProjectId(projectId: string): Promise<CrawlJob | null> {
    const matches = [...this.byId.values()].filter((job) => job.projectId === projectId);
    return matches[matches.length - 1] ?? null;
  }
}

export class FakePageRepository implements PageRepositoryPort {
  readonly saved: Array<{ projectId: string; page: Page }> = [];

  async save(projectId: string, page: Page): Promise<void> {
    this.saved.push({ projectId, page });
  }

  async findById(id: string): Promise<Page | null> {
    return this.saved.find((entry) => entry.page.id === id)?.page ?? null;
  }

  async findByCrawlJobAndUrl(): Promise<Page | null> {
    return null;
  }

  async findAllByCrawlJobId(crawlJobId: string): Promise<Page[]> {
    return this.saved.filter((entry) => entry.page.crawlJobId === crawlJobId).map((entry) => entry.page);
  }

  async countByCrawlJobId(): Promise<number> {
    return this.saved.length;
  }
}

export class FakeCrawlQueuePort implements CrawlQueuePort {
  readonly enqueued: PageTask[] = [];
  readonly finished: string[] = [];
  pendingOverride: number | null = null;

  async enqueue(task: PageTask): Promise<void> {
    this.enqueued.push(task);
  }

  async enqueueMany(tasks: readonly PageTask[]): Promise<void> {
    this.enqueued.push(...tasks);
  }

  async markTaskFinished(crawlJobId: string): Promise<void> {
    this.finished.push(crawlJobId);
  }

  async countPendingForCrawlJob(crawlJobId: string): Promise<number> {
    if (this.pendingOverride !== null) return this.pendingOverride;
    return this.enqueued.filter((task) => task.crawlJobId === crawlJobId).length;
  }
}

export class FakePageFetcher implements PageFetcherPort {
  constructor(private readonly result: Result<PageFetchResult, PageFetchError>) {}

  async fetch(): Promise<Result<PageFetchResult, PageFetchError>> {
    return this.result;
  }
}

export class FakePageRenderer implements PageRendererPort {
  constructor(private readonly result: Result<PageFetchResult, PageFetchError>) {}

  async render(): Promise<Result<PageFetchResult, PageFetchError>> {
    return this.result;
  }
}

export class FakeHtmlParser implements HtmlParserPort {
  constructor(private readonly content: ParsedPageContent) {}

  parse(): ParsedPageContent {
    return this.content;
  }
}

export class SilentLogger implements Logger {
  debug(_message: string, _context?: LogContext): void {}
  info(_message: string, _context?: LogContext): void {}
  warn(_message: string, _context?: LogContext): void {}
  error(_message: string, _context?: LogContext): void {}
}

export function emptyParsedContent(overrides: Partial<ParsedPageContent> = {}): ParsedPageContent {
  return {
    title: null,
    metaDescription: null,
    h1: null,
    canonicalUrl: null,
    wordCount: 0,
    contentHash: "hash",
    contentExcerpt: null,
    links: [],
    faqs: [],
    hasStructuredData: false,
    imagesMissingAltCount: 0,
    mixedContentCount: 0,
    h1Count: 0,
    canonicalTagCount: 0,
    isNoindex: false,
    externalScriptOrigins: [],
    ...overrides,
  };
}

export function fetchOk(overrides: Partial<PageFetchResult> = {}, finalUrl: PageFetchResult["finalUrl"]): Result<PageFetchResult, PageFetchError> {
  return ok({
    finalUrl,
    statusCode: 200,
    html: "<html></html>",
    responseTimeMs: 10,
    redirectChain: [],
    renderMode: "HTTP",
    cspHeader: null,
    ...overrides,
  });
}

export function fetchErr(code: PageFetchError["code"], message = "fetch failed"): Result<PageFetchResult, PageFetchError> {
  return err(new PageFetchError(code, message));
}

// Defaults to "no robots.txt found" (ok(null)) — the same permissive
// default a real 404 produces — so existing tests that don't care about
// robots.txt keep working unchanged.
export class FakeRobotsPort implements RobotsPort {
  fetchCount = 0;

  constructor(private readonly result: Result<string | null, PageFetchError> = ok(null)) {}

  async fetchRobotsTxt(_origin: Url): Promise<Result<string | null, PageFetchError>> {
    this.fetchCount++;
    return this.result;
  }
}

// Resolves immediately by default (no artificial delay in tests) but
// records every call so tests can assert what origin/interval the use
// case asked for.
export class FakeRateLimiter implements RateLimiterPort {
  readonly calls: Array<{ origin: string; minIntervalMs: number }> = [];

  async waitForTurn(origin: string, minIntervalMs: number): Promise<void> {
    this.calls.push({ origin, minIntervalMs });
  }
}
