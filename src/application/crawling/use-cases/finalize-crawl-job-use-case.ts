import type { CrawlJobRepositoryPort } from "@/application/crawling/ports/crawl-job-repository-port";
import type { CrawlQueuePort } from "@/application/crawling/ports/crawl-queue-port";
import type { DomainEventDispatcher } from "@/shared/domain-event-dispatcher";
import type { Logger } from "@/shared/logger";

export interface FinalizeCrawlJobDeps {
  crawlJobRepository: CrawlJobRepositoryPort;
  queue: CrawlQueuePort;
  logger: Logger;
  // Optional: tests and call sites that don't care about CrawlJobCompleted
  // (e.g. AuditRun auto-trigger) reaction can omit it entirely.
  eventDispatcher?: DomainEventDispatcher;
}

// Called after each PageTask finishes (worker "completed"/"failed" events,
// not from inside ProcessPageTaskUseCase itself — the task currently being
// processed is still "active" in the queue while that use case runs, which
// would make this always see >= 1 pending and never complete the job).
// Crawler Engine design §4 completion condition, with the race-condition
// caveat noted on CrawlQueuePort.countPendingForCrawlJob.
export class FinalizeCrawlJobIfDoneUseCase {
  constructor(private readonly deps: FinalizeCrawlJobDeps) {}

  async execute(crawlJobId: string): Promise<void> {
    const { crawlJobRepository, queue, logger, eventDispatcher } = this.deps;

    const crawlJob = await crawlJobRepository.findById(crawlJobId);
    if (!crawlJob || crawlJob.status !== "RUNNING") return;

    const pending = await queue.countPendingForCrawlJob(crawlJobId);
    if (pending > 0 && !crawlJob.hasReachedPageLimit()) return;

    const result = crawlJob.complete();
    if (!result.ok) {
      logger.warn("Failed to finalize crawl job", { crawlJobId, code: result.error.code });
      return;
    }
    await crawlJobRepository.save(crawlJob);

    if (eventDispatcher) {
      await eventDispatcher.dispatch(crawlJob.pullDomainEvents());
    }
  }
}
