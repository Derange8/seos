import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import type { RobotsPort } from "@/application/crawling/ports/robots-port";
import type { PageFetcherPort } from "@/application/crawling/ports/page-fetcher-port";
import { Url } from "@/domain/crawling/value-objects/url";
import {
  analyzeSitemapXml,
  robotsBlocksEntireSite,
  robotsHasSitemapDirective,
} from "@/domain/auditing/services/robots-sitemap-analysis";

export interface AuditRobotsAndSitemapDeps {
  pageRepository: PageRepositoryPort;
  robots: RobotsPort;
  pageFetcher: PageFetcherPort;
}

// Cross-page, same family as DetectOrphanPagesUseCase/DetectBrokenLinksUseCase
// — runs once per crawl job, before RunAuditUseCase (see crawl-pipeline.ts's
// CrawlJobCompleted handler order), so the robots/sitemap audit rules can
// stay plain single-page rules that just read the flags this sets.
//
// Unlike the other cross-page use cases, this one fetches two fresh live
// resources (the site's actual robots.txt/sitemap.xml, not anything already
// captured per-page during the crawl) rather than only comparing data
// already on hand. Both are live-website facts, independent of whatever
// Seos's own generators would produce for this project — see
// robots-generator.ts/sitemap-generator.ts for that separate concern.
//
// Every finding here is site-level, not really "about" any one page, but
// AuditIssue.pageId is required (see that entity) — attaching to the
// crawl's root page (unambiguously the first page any crawl job saves,
// same reasoning DetectOrphanPagesUseCase already uses) is the pragmatic
// choice over a broader pageId-nullable schema change for four rules.
export class AuditRobotsAndSitemapUseCase {
  constructor(private readonly deps: AuditRobotsAndSitemapDeps) {}

  async execute(projectId: string, crawlJobId: string): Promise<void> {
    const pages = await this.deps.pageRepository.findAllByCrawlJobId(crawlJobId);
    if (pages.length === 0) return;

    const rootPage = pages.reduce((earliest, page) =>
      page.crawledAt < earliest.crawledAt ? page : earliest
    );

    const origin = new URL(rootPage.url.href).origin;

    const originUrlResult = Url.create(origin);
    if (!originUrlResult.ok) return;

    const robotsResult = await this.deps.robots.fetchRobotsTxt(originUrlResult.value);
    const rawRobotsTxt = robotsResult.ok ? robotsResult.value : null;

    const robotsFlags =
      rawRobotsTxt === null
        ? { robotsBlocksEntireSite: false, robotsMissingSitemapDirective: null }
        : {
            robotsBlocksEntireSite: robotsBlocksEntireSite(rawRobotsTxt),
            robotsMissingSitemapDirective: !robotsHasSitemapDirective(rawRobotsTxt),
          };

    const sitemapUrlResult = Url.create(new URL("/sitemap.xml", origin).href);
    let sitemapIsUnreachable = true;
    let sitemapIsInvalidXml: boolean | null = null;

    if (sitemapUrlResult.ok) {
      const fetchResult = await this.deps.pageFetcher.fetch(sitemapUrlResult.value);
      if (fetchResult.ok && fetchResult.value.statusCode < 400) {
        sitemapIsUnreachable = false;
        sitemapIsInvalidXml = !analyzeSitemapXml(fetchResult.value.html).isValid;
      }
    }

    rootPage.setRobotsAndSitemapFlags({
      ...robotsFlags,
      sitemapIsUnreachable,
      sitemapIsInvalidXml,
    });
    await this.deps.pageRepository.save(projectId, rootPage);
  }
}
