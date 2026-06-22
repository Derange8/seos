import { createHash } from "node:crypto";
import type { CrawlQueuePort, PageTask } from "@/application/crawling/ports/crawl-queue-port";

export type CrawlPageTaskRunner = (task: PageTask) => Promise<void>;

// Same dedup primitive as the old BullMQ-backed queue (Crawler Engine
// design §4): the normalized URL's hash, scoped per crawl job, is the
// thing that decides "have we ever enqueued this before" — a page
// re-discovered via a second link (e.g. back to the homepage) must not
// re-enter the queue or inflate the pending counter.
function taskHash(task: PageTask): string {
  return createHash("sha1").update(task.url.href).digest("hex");
}

// Replaces BullMQ+Redis for the single-user desktop program: no separate
// service to install, everything runs in this one process. Concurrency is
// enforced here instead of by a Worker's pool — `setRunner()` wires in the
// actual page-processing function once (see crawl-pipeline.ts), then every
// enqueue pumps the internal waiting list against that limit.
export class InProcessCrawlQueue implements CrawlQueuePort {
  private readonly seen = new Map<string, Set<string>>();
  private readonly pendingCounts = new Map<string, number>();
  private readonly waiting: PageTask[] = [];
  private activeCount = 0;
  private runner: CrawlPageTaskRunner | null = null;

  constructor(private readonly concurrency: number) {}

  setRunner(runner: CrawlPageTaskRunner): void {
    this.runner = runner;
    this.pump();
  }

  async enqueue(task: PageTask): Promise<void> {
    this.enqueueOne(task);
  }

  async enqueueMany(tasks: readonly PageTask[]): Promise<void> {
    for (const task of tasks) this.enqueueOne(task);
  }

  async markTaskFinished(crawlJobId: string): Promise<void> {
    const current = this.pendingCounts.get(crawlJobId) ?? 0;
    this.pendingCounts.set(crawlJobId, Math.max(0, current - 1));
  }

  async countPendingForCrawlJob(crawlJobId: string): Promise<number> {
    return this.pendingCounts.get(crawlJobId) ?? 0;
  }

  private enqueueOne(task: PageTask): void {
    const seenSet = this.seen.get(task.crawlJobId) ?? new Set<string>();
    this.seen.set(task.crawlJobId, seenSet);

    const hash = taskHash(task);
    if (seenSet.has(hash)) return; // already enqueued earlier in this crawl job's lifetime
    seenSet.add(hash);

    this.pendingCounts.set(task.crawlJobId, (this.pendingCounts.get(task.crawlJobId) ?? 0) + 1);

    // Ascending-depth insert — shallower pages dequeue first (BFS), same
    // ordering the old queue got from BullMQ's priority option. Crawl
    // queues stay small enough (bounded by maxPages) that an O(n) insert
    // is not worth a real priority-queue data structure.
    const insertAt = this.waiting.findIndex((queued) => queued.depth > task.depth);
    if (insertAt === -1) this.waiting.push(task);
    else this.waiting.splice(insertAt, 0, task);

    this.pump();
  }

  private pump(): void {
    if (!this.runner) return;
    while (this.activeCount < this.concurrency && this.waiting.length > 0) {
      const task = this.waiting.shift();
      if (!task) break;
      this.activeCount++;
      this.runner(task).finally(() => {
        this.activeCount--;
        this.pump();
      });
    }
  }
}
