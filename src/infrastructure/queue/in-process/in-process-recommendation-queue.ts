import type { RecommendationQueuePort } from "@/application/auditing/ports/recommendation-queue-port";

export type RecommendationTaskRunner = (auditRunId: string) => Promise<void>;

// Replaces the BullMQ-backed recommendation queue. Still a separate queue
// from crawl-pages (not folded into the same dispatcher) for the same
// reason as before: LLM calls are slow/flaky in ways nothing else in the
// pipeline is, so they get their own concurrency limit rather than
// competing with page-fetch concurrency.
export class InProcessRecommendationQueue implements RecommendationQueuePort {
  private readonly enqueued = new Set<string>();
  private readonly waiting: string[] = [];
  private activeCount = 0;
  private runner: RecommendationTaskRunner | null = null;

  constructor(private readonly concurrency: number) {}

  setRunner(runner: RecommendationTaskRunner): void {
    this.runner = runner;
    this.pump();
  }

  async enqueue(auditRunId: string): Promise<void> {
    // An AuditRun only ever needs enriching once — mirrors the old queue's
    // jobId-based dedup against a CrawlJobCompleted→AuditRunCompleted
    // chain ever firing twice for the same run.
    if (this.enqueued.has(auditRunId)) return;
    this.enqueued.add(auditRunId);
    this.waiting.push(auditRunId);
    this.pump();
  }

  private pump(): void {
    if (!this.runner) return;
    while (this.activeCount < this.concurrency && this.waiting.length > 0) {
      const auditRunId = this.waiting.shift();
      if (!auditRunId) break;
      this.activeCount++;
      this.runner(auditRunId).finally(() => {
        this.activeCount--;
        this.pump();
      });
    }
  }
}
