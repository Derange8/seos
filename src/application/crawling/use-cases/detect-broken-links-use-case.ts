import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";

export interface DetectBrokenLinksDeps {
  pageRepository: PageRepositoryPort;
}

// Link.isBroken exists on the domain entity but nothing ever set it true —
// a Link is only ever created with isBroken: false during parsing (see
// CheerioHtmlParser), since at parse time we don't yet know whether the
// target was actually reachable. This use case closes that loop, but only
// for internal links: the crawler only ever fetches internal URLs (Crawler
// Engine design §2), so a target's real status code is only known when it's
// internal *and* was fetched within this same crawl job — checking external
// links would require new outbound requests to third-party sites, a
// separate, larger-scoped piece of work.
export class DetectBrokenLinksUseCase {
  constructor(private readonly deps: DetectBrokenLinksDeps) {}

  async execute(projectId: string, crawlJobId: string): Promise<void> {
    const pages = await this.deps.pageRepository.findAllByCrawlJobId(crawlJobId);
    const statusByUrl = new Map(pages.map((page) => [page.url.href, page.statusCode]));

    for (const page of pages) {
      let changed = false;
      for (const link of page.allLinks) {
        if (!link.isInternal || link.isBroken) continue;
        const targetStatus = statusByUrl.get(link.targetUrl.href);
        if (targetStatus !== undefined && targetStatus !== null && targetStatus >= 400) {
          link.markBroken();
          changed = true;
        }
      }
      if (changed) {
        await this.deps.pageRepository.save(projectId, page);
      }
    }
  }
}
