import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { shouldAllowPrivateNetworks } from "@/infrastructure/config/allow-private-networks";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { PrismaPageRepository } from "@/infrastructure/persistence/prisma/prisma-page-repository";
import { HttpPageFetcher } from "@/infrastructure/crawler/http/http-page-fetcher";
import { HttpRobotsFetcher } from "@/infrastructure/crawler/http/http-robots-fetcher";
import { HostRateLimiter } from "@/infrastructure/crawler/rate-limiting/host-rate-limiter";
import { PlaywrightPageRenderer } from "@/infrastructure/crawler/playwright/playwright-page-renderer";
import { PlaywrightWebVitalsMeasurer } from "@/infrastructure/crawler/playwright/playwright-web-vitals-measurer";
import { CheerioHtmlParser } from "@/infrastructure/html/cheerio-html-parser";
import { ConsoleLogger } from "@/infrastructure/logging/console-logger";
import { startGoogleTrackingScheduler } from "@/infrastructure/scheduling/google-tracking-scheduler";
import { startAutoPilotScheduler } from "@/infrastructure/scheduling/auto-pilot-scheduler";
import { InProcessCrawlQueue } from "@/infrastructure/queue/in-process/in-process-crawl-queue";
import { InProcessRecommendationQueue } from "@/infrastructure/queue/in-process/in-process-recommendation-queue";
import { ProcessPageTaskUseCase } from "@/application/crawling/use-cases/process-page-task-use-case";
import { FinalizeCrawlJobIfDoneUseCase } from "@/application/crawling/use-cases/finalize-crawl-job-use-case";
import { DetectBrokenLinksUseCase } from "@/application/crawling/use-cases/detect-broken-links-use-case";
import { DetectDuplicateContentUseCase } from "@/application/crawling/use-cases/detect-duplicate-content-use-case";
import { DetectOrphanPagesUseCase } from "@/application/crawling/use-cases/detect-orphan-pages-use-case";
import { AuditRobotsAndSitemapUseCase } from "@/application/crawling/use-cases/audit-robots-and-sitemap-use-case";
import { CrawlJobCompleted } from "@/domain/crawling/events/crawl-job-completed";
import { AuditRunCompleted } from "@/domain/auditing/events/audit-run-completed";
import { PrismaAuditRunRepository } from "@/infrastructure/persistence/prisma/prisma-audit-run-repository";
import { RunAuditUseCase } from "@/application/auditing/use-cases/run-audit-use-case";
import { PrismaSitemapRepository } from "@/infrastructure/persistence/prisma/prisma-sitemap-repository";
import { GenerateSitemapUseCase } from "@/application/sitemap/use-cases/generate-sitemap-use-case";
import { PrismaLlmsTxtRepository } from "@/infrastructure/persistence/prisma/prisma-llms-txt-repository";
import { GenerateLlmsTxtUseCase } from "@/application/llms-txt/use-cases/generate-llms-txt-use-case";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { PrismaSchemaMarkupRepository } from "@/infrastructure/persistence/prisma/prisma-schema-markup-repository";
import { GenerateSchemaMarkupUseCase } from "@/application/schema-markup/use-cases/generate-schema-markup-use-case";
import { PrismaSeoScoreRepository } from "@/infrastructure/persistence/prisma/prisma-seo-score-repository";
import { CalculateSeoScoresUseCase } from "@/application/scoring/use-cases/calculate-seo-scores-use-case";
import { PrismaFixCandidateRepository } from "@/infrastructure/persistence/prisma/prisma-fix-candidate-repository";
import { PrismaKeywordOpportunityRepository } from "@/infrastructure/persistence/prisma/prisma-keyword-opportunity-repository";
import { GenerateFixCandidatesUseCase } from "@/application/fixes/use-cases/generate-fix-candidates-use-case";
import { GenerateAuditRecommendationsUseCase } from "@/application/auditing/use-cases/generate-audit-recommendations-use-case";
import { AutoApplyApprovedFixesUseCase } from "@/application/wordpress/use-cases/auto-apply-approved-fixes-use-case";
import { PrismaWordPressConnectionRepository } from "@/infrastructure/persistence/prisma/prisma-wordpress-connection-repository";
import { WordPressRestApiClient } from "@/infrastructure/wordpress/wordpress-rest-api-client";
import { DynamicRecommendationProvider } from "@/infrastructure/llm/dynamic-recommendation-provider";
import { PrismaLlmSettingsRepository } from "@/infrastructure/persistence/prisma/prisma-llm-settings-repository";
import { DomainEventDispatcher } from "@/shared/domain-event-dispatcher";
import { PrismaEventHandlerFailureStore } from "@/infrastructure/persistence/prisma/prisma-event-handler-failure-store";

const CRAWL_CONCURRENCY = Number(process.env.CRAWL_WORKER_CONCURRENCY ?? 5);
const RECOMMENDATION_CONCURRENCY = Number(process.env.RECOMMENDATION_WORKER_CONCURRENCY ?? 2);

export interface CrawlPipeline {
  crawlQueue: InProcessCrawlQueue;
}

// Replaces workers/crawl-worker.ts + workers/recommendation-worker.ts as
// separate OS processes: a single-user desktop program runs everything in
// this one Next.js process, so the BullMQ Worker (and the Redis it needed)
// is replaced by two in-process, concurrency-limited queues. The pipeline
// wiring itself — which use case reacts to which domain event — is
// unchanged from the old workers, just assembled in one place instead of
// two files.
export function createCrawlPipeline(
  options: { crawlConcurrency?: number; recommendationConcurrency?: number; allowPrivateNetworks?: boolean } = {}
): CrawlPipeline {
  const logger = new ConsoleLogger();
  const crawlJobRepository = new PrismaCrawlJobRepository(prisma);
  const pageRepository = new PrismaPageRepository(prisma);
  const crawlQueue = new InProcessCrawlQueue(options.crawlConcurrency ?? CRAWL_CONCURRENCY);
  const renderer = new PlaywrightPageRenderer({ allowPrivateNetworks: options.allowPrivateNetworks });

  const processPageTask = new ProcessPageTaskUseCase({
    fetcher: new HttpPageFetcher({ allowPrivateNetworks: options.allowPrivateNetworks }),
    renderer,
    htmlParser: new CheerioHtmlParser(),
    crawlJobRepository,
    pageRepository,
    queue: crawlQueue,
    robots: new HttpRobotsFetcher({ allowPrivateNetworks: options.allowPrivateNetworks }),
    rateLimiter: new HostRateLimiter(),
    logger,
    webVitals: new PlaywrightWebVitalsMeasurer({ allowPrivateNetworks: options.allowPrivateNetworks }),
  });

  const auditRunRepository = new PrismaAuditRunRepository(prisma);
  const eventDispatcher = new DomainEventDispatcher(logger, new PrismaEventHandlerFailureStore(prisma));

  const runAudit = new RunAuditUseCase({ pageRepository, auditRunRepository, eventDispatcher });
  const detectBrokenLinks = new DetectBrokenLinksUseCase({ pageRepository });
  const detectDuplicateContent = new DetectDuplicateContentUseCase({ pageRepository });
  const detectOrphanPages = new DetectOrphanPagesUseCase({ pageRepository });
  const auditRobotsAndSitemap = new AuditRobotsAndSitemapUseCase({
    pageRepository,
    robots: new HttpRobotsFetcher({ allowPrivateNetworks: options.allowPrivateNetworks }),
    pageFetcher: new HttpPageFetcher({ allowPrivateNetworks: options.allowPrivateNetworks }),
  });

  const generateSitemap = new GenerateSitemapUseCase({
    pageRepository,
    sitemapRepository: new PrismaSitemapRepository(prisma),
  });

  const projectRepository = new PrismaProjectRepository(prisma);

  const generateSchemaMarkup = new GenerateSchemaMarkupUseCase({
    pageRepository,
    projectRepository,
    schemaMarkupRepository: new PrismaSchemaMarkupRepository(prisma),
  });

  const generateLlmsTxt = new GenerateLlmsTxtUseCase({
    pageRepository,
    projectRepository,
    llmsTxtRepository: new PrismaLlmsTxtRepository(prisma),
  });

  const calculateSeoScores = new CalculateSeoScoresUseCase({
    auditRunRepository,
    pageRepository,
    seoScoreRepository: new PrismaSeoScoreRepository(prisma),
  });

  const fixCandidateRepository = new PrismaFixCandidateRepository(prisma);

  const generateFixCandidates = new GenerateFixCandidatesUseCase({
    auditRunRepository,
    pageRepository,
    fixCandidateRepository,
    keywordOpportunityRepository: new PrismaKeywordOpportunityRepository(prisma),
  });

  const autoApplyApprovedFixes = new AutoApplyApprovedFixesUseCase(
    {
      auditRunRepository,
      projectRepository,
      fixCandidateRepository,
      pageRepository,
      crawlJobRepository,
      wordPressConnectionRepository: new PrismaWordPressConnectionRepository(prisma),
      wordPressClient: new WordPressRestApiClient({ allowPrivateNetworks: options.allowPrivateNetworks }),
    },
    logger
  );

  const recommendationQueue = new InProcessRecommendationQueue(
    options.recommendationConcurrency ?? RECOMMENDATION_CONCURRENCY
  );
  const generateRecommendations = new GenerateAuditRecommendationsUseCase({
    auditRunRepository,
    llm: new DynamicRecommendationProvider(new PrismaLlmSettingsRepository(prisma), logger),
  });
  recommendationQueue.setRunner(async (auditRunId) => {
    try {
      await generateRecommendations.execute(auditRunId);
    } catch (error) {
      logger.error("Recommendation generation failed", {
        auditRunId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Architecture decision (unchanged from the old workers): a crawl
  // finishing auto-triggers an audit run, sitemap, schema-markup, and
  // llms.txt generation — all pure/in-memory over already-fetched pages,
  // so they run inline with no extra queue. Independent handlers, not
  // chained, so one failing doesn't block the others. Recommendation
  // enrichment is the one exception — a real LLM call, slow and fallible
  // in ways nothing else here is, so it only enqueues onto its own queue.
  //
  // detectBrokenLinks, detectDuplicateContent, detectOrphanPages, and
  // auditRobotsAndSitemap are the ordering exception: DomainEventDispatcher
  // runs same-event handlers sequentially in registration order (see
  // dispatch()), and several rules (broken-internal-links,
  // duplicate-title/meta/content, orphan-page, robots-blocks-entire-site/
  // robots-missing-sitemap-directive/sitemap-unreachable/sitemap-invalid-xml)
  // read flags only these four set — so all four must run and finish
  // before runAudit, not just be independent of it.
  eventDispatcher.on(CrawlJobCompleted, async (event) => {
    await detectBrokenLinks.execute(event.projectId, event.crawlJobId);
  });
  eventDispatcher.on(CrawlJobCompleted, async (event) => {
    await detectDuplicateContent.execute(event.projectId, event.crawlJobId);
  });
  eventDispatcher.on(CrawlJobCompleted, async (event) => {
    await detectOrphanPages.execute(event.projectId, event.crawlJobId);
  });
  eventDispatcher.on(CrawlJobCompleted, async (event) => {
    await auditRobotsAndSitemap.execute(event.projectId, event.crawlJobId);
  });
  eventDispatcher.on(CrawlJobCompleted, async (event) => {
    await runAudit.execute(event.projectId, event.crawlJobId);
  });
  eventDispatcher.on(CrawlJobCompleted, async (event) => {
    await generateSitemap.execute(event.projectId, event.crawlJobId);
  });
  eventDispatcher.on(CrawlJobCompleted, async (event) => {
    await generateSchemaMarkup.execute(event.projectId, event.crawlJobId);
  });
  eventDispatcher.on(CrawlJobCompleted, async (event) => {
    await generateLlmsTxt.execute(event.projectId, event.crawlJobId);
  });
  eventDispatcher.on(AuditRunCompleted, async (event) => {
    await calculateSeoScores.execute(event.auditRunId);
  });
  eventDispatcher.on(AuditRunCompleted, async (event) => {
    await generateFixCandidates.execute(event.auditRunId);
  });
  // Must run after generateFixCandidates' own handler above — same
  // same-event registration-order guarantee DomainEventDispatcher already
  // relies on elsewhere (see the detectBrokenLinks/runAudit comment) —
  // there's nothing to auto-apply until this run's FixCandidates exist.
  eventDispatcher.on(AuditRunCompleted, async (event) => {
    await autoApplyApprovedFixes.execute(event.auditRunId);
  });
  eventDispatcher.on(AuditRunCompleted, async (event) => {
    await recommendationQueue.enqueue(event.auditRunId);
  });

  const finalizeCrawlJob = new FinalizeCrawlJobIfDoneUseCase({
    crawlJobRepository,
    queue: crawlQueue,
    logger,
    eventDispatcher,
  });

  crawlQueue.setRunner(async (task) => {
    try {
      await processPageTask.execute(task);
    } catch (error) {
      logger.error("Page task processing failed", {
        url: task.url.href,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await crawlQueue.markTaskFinished(task.crawlJobId);
      await finalizeCrawlJob.execute(task.crawlJobId);
    }
  });

  return { crawlQueue };
}

const globalForPipeline = globalThis as unknown as {
  crawlPipeline?: CrawlPipeline;
  googleTrackingSchedulerStarted?: boolean;
  autoPilotSchedulerStarted?: boolean;
};

// Same singleton rationale as prisma-client.ts — one pipeline (and its
// in-process queues) shared across requests in this process, surviving
// Next.js dev hot-reload.
export const crawlPipeline: CrawlPipeline =
  globalForPipeline.crawlPipeline ?? createCrawlPipeline({ allowPrivateNetworks: shouldAllowPrivateNetworks() });

if (process.env.NODE_ENV !== "production") {
  globalForPipeline.crawlPipeline = crawlPipeline;
}

export const crawlQueue = crawlPipeline.crawlQueue;

// Started once alongside the rest of the app's long-lived singletons —
// guarded the same way the pipeline itself is, so Next dev's hot-reload
// doesn't accumulate a second interval timer on every module re-evaluation.
if (!globalForPipeline.googleTrackingSchedulerStarted) {
  startGoogleTrackingScheduler(new ConsoleLogger());
  globalForPipeline.googleTrackingSchedulerStarted = true;
}

if (!globalForPipeline.autoPilotSchedulerStarted) {
  startAutoPilotScheduler(crawlQueue, new ConsoleLogger());
  globalForPipeline.autoPilotSchedulerStarted = true;
}
