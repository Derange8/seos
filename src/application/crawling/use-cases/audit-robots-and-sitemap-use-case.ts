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

// Real sitemaps (WordPress/Yoast, most large CMSes) commonly split page
// URLs across several leaf sitemaps (post-sitemap.xml, page-sitemap.xml,
// ...) and list only those in the top-level sitemap.xml — a
// <sitemapindex>. Bounded fan-out, not unlimited: a hostile or
// misconfigured index could otherwise point at hundreds of "child"
// sitemaps and turn one crawl's post-processing into hundreds of extra
// HTTP requests. This covers every real CMS sitemap structure seen in
// practice (a handful of leaf files) while capping the worst case.
const MAX_CHILD_SITEMAPS = 20;

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
    let sitemapUrls: Set<string> | null = null;

    if (sitemapUrlResult.ok) {
      const fetchResult = await this.deps.pageFetcher.fetch(sitemapUrlResult.value);
      if (fetchResult.ok && fetchResult.value.statusCode < 400) {
        sitemapIsUnreachable = false;
        const analysis = analyzeSitemapXml(fetchResult.value.html);
        sitemapIsInvalidXml = !analysis.isValid;
        if (analysis.isValid) {
          sitemapUrls = analysis.isSitemapIndex
            ? await this.resolveSitemapIndex(analysis.urls)
            : new Set(analysis.urls);
        }
      }
    }

    rootPage.setRobotsAndSitemapFlags({
      ...robotsFlags,
      sitemapIsUnreachable,
      sitemapIsInvalidXml,
    });

    // Per-page, not site-level like the flags above — every crawled page
    // (not just the root) needs its own answer to "is this URL actually
    // listed in the live sitemap," since that's what lets
    // broken-status-code-rule tell a 404 the site owner still points
    // search engines at (sitemapUrls has it) apart from one that's simply
    // fallen out of the site's own navigation and sitemap alike. Null
    // (sitemapUrls === null) propagates "couldn't determine this run" to
    // every page rather than defaulting to false, which would read as a
    // confident "not in the sitemap" when the sitemap was never actually
    // read.
    for (const page of pages) {
      const isInSitemap = sitemapUrls === null ? null : sitemapUrls.has(page.url.href);
      page.setIsInSitemap(isInSitemap);
    }

    await this.deps.pageRepository.save(projectId, rootPage);
    for (const page of pages) {
      if (page.id === rootPage.id) continue; // already saved above with the site-level flags
      await this.deps.pageRepository.save(projectId, page);
    }
  }

  // Fetches every child sitemap listed in a <sitemapindex> and merges
  // their page URLs into one set. A child that fails to fetch or parse is
  // skipped, not treated as "the whole index failed" — a site with one
  // broken leaf sitemap (e.g. a plugin-generated one that's temporarily
  // 500ing) shouldn't lose isInSitemap coverage for every other leaf that
  // fetched fine.
  private async resolveSitemapIndex(childSitemapUrls: readonly string[]): Promise<Set<string>> {
    const merged = new Set<string>();
    for (const rawUrl of childSitemapUrls.slice(0, MAX_CHILD_SITEMAPS)) {
      const childUrlResult = Url.create(rawUrl);
      if (!childUrlResult.ok) continue;

      const fetchResult = await this.deps.pageFetcher.fetch(childUrlResult.value);
      if (!fetchResult.ok || fetchResult.value.statusCode >= 400) continue;

      const analysis = analyzeSitemapXml(fetchResult.value.html);
      if (!analysis.isValid || analysis.isSitemapIndex) continue; // one level of nesting only
      for (const url of analysis.urls) merged.add(url);
    }
    return merged;
  }
}
