import type { PageFetcherPort } from "@/application/crawling/ports/page-fetcher-port";
import type { PageRendererPort } from "@/application/crawling/ports/page-renderer-port";
import type { HtmlParserPort } from "@/application/crawling/ports/html-parser-port";
import type { CrawlJobRepositoryPort } from "@/application/crawling/ports/crawl-job-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import type { CrawlQueuePort, PageTask } from "@/application/crawling/ports/crawl-queue-port";
import type { RobotsPort } from "@/application/crawling/ports/robots-port";
import type { RateLimiterPort } from "@/application/crawling/ports/rate-limiter-port";
import type { WebVitalsPort } from "@/application/crawling/ports/web-vitals-port";
import { needsRendering } from "@/domain/crawling/services/js-rendering-heuristic";
import { Page } from "@/domain/crawling/entities/page";
import { Link } from "@/domain/crawling/entities/link";
import { Url } from "@/domain/crawling/value-objects/url";
import { RobotsRules } from "@/domain/crawling/value-objects/robots-rules";
import type { Logger } from "@/shared/logger";

export interface ProcessPageTaskDeps {
  fetcher: PageFetcherPort;
  renderer: PageRendererPort;
  htmlParser: HtmlParserPort;
  crawlJobRepository: CrawlJobRepositoryPort;
  pageRepository: PageRepositoryPort;
  queue: CrawlQueuePort;
  robots: RobotsPort;
  rateLimiter: RateLimiterPort;
  logger: Logger;
  // Optional: only required when a crawl actually opts into
  // CrawlConfig.measureWebVitals — keeps every existing test/caller that
  // doesn't care about Core Web Vitals unchanged.
  webVitals?: WebVitalsPort;
}

// Politeness floor when robots.txt specifies no Crawl-delay (or
// respectRobots is off) — still don't fire requests at a target faster
// than this, regardless of the crawl's concurrency setting.
const DEFAULT_MIN_INTERVAL_MS = 500;
// Ceiling on a site's own Crawl-delay: respecting an operator-specified
// value is correct, but an extreme one (some sites set this specifically
// to deter crawlers) would make the user's own crawl of their own site
// impractically slow with no way to override it. This caps the courtesy,
// it doesn't remove it.
const MAX_CRAWL_DELAY_SECONDS = 60;

// A page only counts as client-side-only content when the raw fetch is
// genuinely near-empty (a real but modest server-rendered word count isn't
// this problem) AND the rendered version is substantially larger — both
// conditions guard against flagging normal pages where the two counts
// differ by a little for unrelated reasons (ads, cookie banners, A/B
// tests adding a sentence).
const RAW_NEAR_EMPTY_THRESHOLD = 50;
const RENDERED_MULTIPLE_THRESHOLD = 3;

function isClientSideOnly(rawWordCount: number, renderedWordCount: number): boolean {
  if (rawWordCount >= RAW_NEAR_EMPTY_THRESHOLD) return false;
  if (renderedWordCount === 0) return false;
  return renderedWordCount >= rawWordCount * RENDERED_MULTIPLE_THRESHOLD && renderedWordCount - rawWordCount >= 100;
}

// One PageTask end-to-end: fetch -> (maybe render) -> parse -> persist ->
// enqueue newly discovered internal links. Crawler Engine design §4/§6.
export class ProcessPageTaskUseCase {
  // Cached per crawl job (not per task) — every task for the same job
  // shares one robots.txt fetch+parse rather than re-fetching it on every
  // single page. Keyed by a Promise, not the resolved value, so tasks that
  // race in before the first fetch settles await the same in-flight
  // request instead of each issuing their own.
  private readonly robotsRulesByCrawlJob = new Map<string, Promise<RobotsRules>>();

  constructor(private readonly deps: ProcessPageTaskDeps) {}

  async execute(task: PageTask): Promise<void> {
    const { fetcher, renderer, htmlParser, crawlJobRepository, pageRepository, queue, robots, rateLimiter, logger } =
      this.deps;

    const crawlJob = await crawlJobRepository.findById(task.crawlJobId);
    if (!crawlJob) {
      logger.warn("Skipping page task for unknown crawl job", { crawlJobId: task.crawlJobId });
      return;
    }
    if (crawlJob.status !== "RUNNING") {
      logger.info("Skipping page task; crawl job is not running", {
        crawlJobId: task.crawlJobId,
        status: crawlJob.status,
      });
      return;
    }

    let minIntervalMs = DEFAULT_MIN_INTERVAL_MS;
    if (crawlJob.config.respectRobots) {
      const rules = await this.getRobotsRules(crawlJob.id, task.url, robots);
      if (!rules.isAllowed(task.url.pathname)) {
        logger.info("Skipping page disallowed by robots.txt", { url: task.url.href });
        return;
      }
      if (rules.crawlDelaySeconds !== null) {
        minIntervalMs = Math.min(rules.crawlDelaySeconds, MAX_CRAWL_DELAY_SECONDS) * 1000;
      }
    }
    await rateLimiter.waitForTurn(task.url.origin, minIntervalMs);

    const httpResult = await fetcher.fetch(task.url);
    if (!httpResult.ok) {
      logger.warn("Page fetch failed", { url: task.url.href, code: httpResult.error.code });
      return;
    }

    const rawHtml = httpResult.value.html;
    let fetched = httpResult.value;
    let rendered = false;
    if (needsRendering(rawHtml)) {
      const renderResult = await renderer.render(task.url);
      if (renderResult.ok) {
        fetched = renderResult.value;
        rendered = true;
      } else {
        logger.warn("Render fallback failed, keeping the HTTP-fetched result", {
          url: task.url.href,
          code: renderResult.error.code,
        });
      }
    }

    // Opt-in (CrawlConfig.deepCsrCheck): even when the cheap heuristic above
    // didn't flag this page as JS-dependent, render it anyway to check
    // whether a browser sees meaningfully more content than Googlebot's
    // plain HTML fetch would — e.g. a Next.js page that isn't a bare SPA
    // shell (so needsRendering's pattern never matches) but still fetches
    // its real content client-side via useEffect after the initial paint.
    // Skipped when the heuristic already rendered above — parsed.wordCount
    // below already IS the rendered side of the comparison, no second render.
    let rawWordCount: number | null = null;
    let renderedWordCount: number | null = null;
    if (crawlJob.config.deepCsrCheck) {
      rawWordCount = htmlParser.parse(rawHtml, task.url).wordCount;

      if (!rendered) {
        const renderResult = await renderer.render(task.url);
        if (renderResult.ok) {
          renderedWordCount = htmlParser.parse(renderResult.value.html, renderResult.value.finalUrl).wordCount;
        } else {
          logger.warn("Deep CSR check render failed, skipping comparison for this page", {
            url: task.url.href,
            code: renderResult.error.code,
          });
        }
      }
    }

    const parsed = htmlParser.parse(fetched.html, fetched.finalUrl);
    if (crawlJob.config.deepCsrCheck && rendered) {
      renderedWordCount = parsed.wordCount;
    }
    const isClientSideOnlyContent =
      rawWordCount !== null && renderedWordCount !== null
        ? isClientSideOnly(rawWordCount, renderedWordCount)
        : false;

    // Opt-in (CrawlConfig.measureWebVitals): a separate real navigation
    // dedicated to timing collection (see PlaywrightWebVitalsMeasurer) —
    // not reused from the fetch/render above, since those don't inject the
    // PerformanceObserver collector script and re-navigating is simpler
    // than threading that concern through PageRendererPort's shared path.
    let lcpMs: number | null = null;
    let cls: number | null = null;
    let tbtMs: number | null = null;
    if (crawlJob.config.measureWebVitals && this.deps.webVitals) {
      const vitalsResult = await this.deps.webVitals.measure(task.url);
      if (vitalsResult.ok) {
        lcpMs = vitalsResult.value.lcpMs;
        cls = vitalsResult.value.cls;
        tbtMs = vitalsResult.value.tbtMs;
      } else {
        logger.warn("Web vitals measurement failed, skipping for this page", {
          url: task.url.href,
          code: vitalsResult.error.code,
        });
      }
    }

    const page = Page.create(crawlJob.id, fetched.finalUrl, {
      statusCode: fetched.statusCode,
      title: parsed.title,
      metaDescription: parsed.metaDescription,
      h1: parsed.h1,
      canonicalUrl: parsed.canonicalUrl,
      contentHash: parsed.contentHash,
      wordCount: parsed.wordCount,
      contentExcerpt: parsed.contentExcerpt,
      faqs: parsed.faqs,
      responseTimeMs: fetched.responseTimeMs,
      hasStructuredData: parsed.hasStructuredData,
      structuredDataTypes: parsed.structuredDataTypes,
      hasInvalidStructuredData: parsed.hasInvalidStructuredData,
      imagesMissingAltCount: parsed.imagesMissingAltCount,
      redirectChain: fetched.redirectChain,
      mixedContentCount: parsed.mixedContentCount,
      h1Count: parsed.h1Count,
      canonicalTagCount: parsed.canonicalTagCount,
      isNoindex: parsed.isNoindex,
      cspHeader: fetched.cspHeader,
      externalScriptOrigins: parsed.externalScriptOrigins,
      rawWordCount,
      isClientSideOnlyContent,
      lcpMs,
      cls,
      tbtMs,
    });

    const discoveredTasks: PageTask[] = [];
    for (const rawHref of parsed.links) {
      const targetResult = Url.create(rawHref);
      if (!targetResult.ok) continue;
      const targetUrl = targetResult.value;

      const link = Link.create(page.id, fetched.finalUrl, targetUrl);
      page.addLink(link);

      // /cdn-cgi/ is Cloudflare's own infrastructure namespace (present on
      // every Cloudflare-proxied site, not site content) — most commonly
      // reached via /cdn-cgi/l/email-protection, the decoder link Cloudflare
      // substitutes for obfuscated mailto: addresses. Crawling it produces
      // a bot-challenge page ("Please enable cookies...") that pollutes
      // audit issues and fix suggestions with garbage.
      const isCloudflareInfraPath = targetUrl.pathname.startsWith("/cdn-cgi/");

      if (link.isInternal && !isCloudflareInfraPath && task.depth + 1 <= crawlJob.config.maxDepth) {
        discoveredTasks.push({
          crawlJobId: crawlJob.id,
          url: targetUrl,
          depth: task.depth + 1,
          discoveredFrom: fetched.finalUrl.href,
        });
      }
    }

    await pageRepository.save(crawlJob.projectId, page);

    const addResult = crawlJob.addPage(page);
    if (!addResult.ok) {
      logger.info("Crawl job did not accept the page (limit reached or no longer running)", {
        crawlJobId: crawlJob.id,
        code: addResult.error.code,
      });
    } else {
      // Atomic increment, not save(crawlJob) — many of these run concurrently
      // for the same crawl job, and persisting the in-memory pageCount
      // snapshot would lose increments under a read-modify-write race.
      await crawlJobRepository.incrementPageCount(crawlJob.id);
    }

    if (discoveredTasks.length > 0 && addResult.ok) {
      await queue.enqueueMany(discoveredTasks);
    }
  }

  private getRobotsRules(crawlJobId: string, url: Url, robots: RobotsPort): Promise<RobotsRules> {
    const cached = this.robotsRulesByCrawlJob.get(crawlJobId);
    if (cached) return cached;

    const promise = robots.fetchRobotsTxt(url).then((result) =>
      result.ok && result.value !== null ? RobotsRules.parse(result.value) : RobotsRules.allowAll()
    );
    this.robotsRulesByCrawlJob.set(crawlJobId, promise);
    return promise;
  }
}
