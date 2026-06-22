import type { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import type { Page } from "@/domain/crawling/entities/page";

export interface CrawlJobDto {
  id: string;
  projectId: string;
  status: string;
  pageCount: number;
  maxPages: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

export function toCrawlJobDto(crawlJob: CrawlJob): CrawlJobDto {
  return {
    id: crawlJob.id,
    projectId: crawlJob.projectId,
    status: crawlJob.status,
    pageCount: crawlJob.pageCount,
    maxPages: crawlJob.config.maxPages,
    startedAt: crawlJob.startedAt?.toISOString() ?? null,
    finishedAt: crawlJob.finishedAt?.toISOString() ?? null,
    error: crawlJob.error,
  };
}

export interface PageDto {
  id: string;
  url: string;
  statusCode: number | null;
  title: string | null;
  wordCount: number | null;
  linkCount: number;
}

export function toPageDto(page: Page): PageDto {
  return {
    id: page.id,
    url: page.url.href,
    statusCode: page.statusCode,
    title: page.title,
    wordCount: page.wordCount,
    linkCount: page.allLinks.length,
  };
}
