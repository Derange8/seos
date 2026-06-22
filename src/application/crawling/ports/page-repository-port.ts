import type { Page } from "@/domain/crawling/entities/page";

export interface PageRepositoryPort {
  // Upsert on (crawlJobId, url) — a re-fetched/retried PageTask must safely
  // overwrite rather than duplicate (Crawler Engine design §4). projectId is
  // passed explicitly rather than read off the Page entity: it's a
  // persistence-schema FK (Page belongs to Project directly, not only via
  // CrawlJob), not a concept the crawling domain itself needs to carry.
  save(projectId: string, page: Page): Promise<void>;
  findById(id: string): Promise<Page | null>;
  findByCrawlJobAndUrl(crawlJobId: string, url: string): Promise<Page | null>;
  findAllByCrawlJobId(crawlJobId: string): Promise<Page[]>;
  countByCrawlJobId(crawlJobId: string): Promise<number>;
}
