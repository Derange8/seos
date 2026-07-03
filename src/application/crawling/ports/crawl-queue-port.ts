import type { Url } from "@/domain/crawling/value-objects/url";

// Unit of work enqueued for a single URL within a crawl job. See Crawler
// Engine design §4 for the full lifecycle (queued -> active -> completed /
// failed -> dead-letter).
export interface PageTask {
  crawlJobId: string;
  url: Url;
  depth: number;
  discoveredFrom: string | null;
}

// Abstracts the durable work queue (BullMQ/Redis in infrastructure). The
// queue implementation owns deduplication (by normalized-URL job ID),
// per-domain rate limiting, and depth-based priority — none of that is
// visible at this port boundary, the use case just enqueues tasks.
export interface CrawlQueuePort {
  enqueue(task: PageTask): Promise<void>;
  enqueueMany(tasks: readonly PageTask[]): Promise<void>;
  // Must be called exactly once per dequeued task once its processing has
  // finished (success or failure) — pairs with the implicit "pending" mark
  // made by enqueue/enqueueMany, so countPendingForCrawlJob can answer "is
  // this crawl job done?" without scanning the underlying work queue's
  // internal state (see BullMqCrawlQueue for why that scan is unreliable).
  markTaskFinished(crawlJobId: string): Promise<void>;
  // Used to detect "the crawl job has nothing left to process" (Crawler
  // Engine design §4 job-completion condition).
  countPendingForCrawlJob(crawlJobId: string): Promise<number>;
  // Called once a crawl job has been finalized (COMPLETED/FAILED) — drops
  // any per-job dedup/bookkeeping state the implementation keeps (e.g.
  // InProcessCrawlQueue's `seen` set), so a long-lived process doesn't
  // accumulate an entry per crawl job forever.
  clearJob(crawlJobId: string): Promise<void>;
}
