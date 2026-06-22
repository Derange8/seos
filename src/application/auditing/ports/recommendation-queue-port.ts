export interface RecommendationQueuePort {
  // Decoupled from the crawl pipeline on purpose: LLM calls are slow,
  // costly, and can fail in ways pure in-memory generation (audit/sitemap/
  // schema) never does — queueing this onto its own worker means a flaky
  // LLM provider can't stall crawl throughput.
  enqueue(auditRunId: string): Promise<void>;
}
