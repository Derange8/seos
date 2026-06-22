import type { CrawlJob } from "@/domain/crawling/entities/crawl-job";

export interface CrawlJobRepositoryPort {
  save(crawlJob: CrawlJob): Promise<void>;
  findById(id: string): Promise<CrawlJob | null>;
  // Atomic DB-level increment, not a load-mutate-save round trip — multiple
  // workers call this concurrently for the same crawl job (one per page
  // finished), and a save()-based update would lose increments to a classic
  // read-modify-write race.
  incrementPageCount(crawlJobId: string): Promise<number>;
  // A PENDING/RUNNING crawl job for this project, if one exists —
  // StartCrawlUseCase's only consumer, to refuse starting a second
  // concurrent crawl for the same project.
  findActiveByProjectId(projectId: string): Promise<CrawlJob | null>;
  // The most recently created crawl job for this project, regardless of
  // status — lets the dashboard restore "what happened last time" on page
  // load, instead of only ever showing results from a crawl started in
  // the current browser session.
  findLatestByProjectId(projectId: string): Promise<CrawlJob | null>;
}
