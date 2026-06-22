import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";

export interface DetectOrphanPagesDeps {
  pageRepository: PageRepositoryPort;
}

// Cross-page comparison, same family as DetectBrokenLinksUseCase/
// DetectDuplicateContentUseCase — runs once per crawl job, before
// RunAuditUseCase (see crawl-pipeline.ts's CrawlJobCompleted handler
// order), so orphan-page-rule can stay a plain single-page rule that just
// reads the flag this sets.
export class DetectOrphanPagesUseCase {
  constructor(private readonly deps: DetectOrphanPagesDeps) {}

  async execute(projectId: string, crawlJobId: string): Promise<void> {
    const pages = await this.deps.pageRepository.findAllByCrawlJobId(crawlJobId);
    if (pages.length === 0) return;

    // The crawl always starts from one root URL, and the queue is fed by
    // following links discovered while parsing already-fetched pages —
    // nothing is enqueued before the root is fetched, so the root is
    // unambiguously the first page any crawl job ever saves. It's exempt
    // from "orphan" even though nothing crawled links back to it either.
    const rootPage = pages.reduce((earliest, page) =>
      page.crawledAt < earliest.crawledAt ? page : earliest
    );

    const linkedToUrls = new Set<string>();
    for (const page of pages) {
      for (const link of page.allLinks) {
        if (link.isInternal) linkedToUrls.add(link.targetUrl.href);
      }
    }

    for (const page of pages) {
      const isOrphan = page.id !== rootPage.id && !linkedToUrls.has(page.url.href);
      if (isOrphan === page.isOrphan) continue;

      page.setOrphan(isOrphan);
      await this.deps.pageRepository.save(projectId, page);
    }
  }
}
