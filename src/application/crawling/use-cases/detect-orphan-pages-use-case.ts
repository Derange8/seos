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

    // Counts distinct linking pages, not raw link occurrences — two links
    // to the same target from one page's nav and footer should count as
    // one inbound reference, not two, since it's "how many pages point
    // here" (a real breakage signal) that matters, not "how many <a> tags."
    const inboundLinkersByUrl = new Map<string, Set<string>>();
    for (const page of pages) {
      for (const link of page.allLinks) {
        if (!link.isInternal) continue;
        const linkers = inboundLinkersByUrl.get(link.targetUrl.href) ?? new Set<string>();
        linkers.add(page.id);
        inboundLinkersByUrl.set(link.targetUrl.href, linkers);
      }
    }

    for (const page of pages) {
      const inboundInternalLinkCount = inboundLinkersByUrl.get(page.url.href)?.size ?? 0;
      const isOrphan = page.id !== rootPage.id && inboundInternalLinkCount === 0;
      if (isOrphan === page.isOrphan && inboundInternalLinkCount === page.inboundInternalLinkCount) continue;

      page.setOrphan(isOrphan, inboundInternalLinkCount);
      await this.deps.pageRepository.save(projectId, page);
    }
  }
}
