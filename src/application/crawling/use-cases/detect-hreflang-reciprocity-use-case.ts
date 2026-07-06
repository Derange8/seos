import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import type { Page } from "@/domain/crawling/entities/page";
import type { HreflangLink } from "@/domain/crawling/entities/page";

export interface DetectHreflangReciprocityDeps {
  pageRepository: PageRepositoryPort;
}

// Whether `target` links back to `source` at all — just a matching URL,
// NOT a matching hreflang value. Each page in a cluster declares its OWN
// language/region for every other member (e.g. the English page's tag for
// the Turkish page says hreflang="tr", while the Turkish page's tag for
// the English page says hreflang="en" — the two ends of one pair almost
// always carry different hreflang values, since each names the *other*
// page's locale, not its own). What Google's spec actually requires is
// that the URL relationship is mutual; the return tag's own hreflang value
// is a separate, unrelated fact about the target's own locale, not
// something to compare against the source's declared value.
function hasReturnTag(target: Page, source: Page): boolean {
  return target.hreflangLinks.some((link) => link.url === source.url.href);
}

// Cross-page, same family as DetectOrphanPagesUseCase/DetectDuplicateContentUseCase
// — runs once per crawl job, before RunAuditUseCase (see crawl-pipeline.ts's
// CrawlJobCompleted handler order), so hreflang-missing-return-tag-rule can
// stay a plain single-page rule that just reads the flag this sets.
//
// Google's hreflang spec requires every pair to be reciprocal: if page A
// declares an hreflang alternate pointing at page B, B must declare one
// pointing back at A with the same hreflang value, or Google ignores the
// annotation for BOTH pages entirely — a silent, invisible failure mode no
// single-page check could ever catch (page A's own markup looks perfectly
// valid in isolation).
export class DetectHreflangReciprocityUseCase {
  constructor(private readonly deps: DetectHreflangReciprocityDeps) {}

  async execute(projectId: string, crawlJobId: string): Promise<void> {
    const pages = await this.deps.pageRepository.findAllByCrawlJobId(crawlJobId);
    if (pages.length === 0) return;

    const pagesByUrl = new Map<string, Page>();
    for (const page of pages) {
      pagesByUrl.set(page.url.href, page);
    }

    for (const page of pages) {
      if (page.hreflangLinks.length === 0) continue;

      const missing: HreflangLink[] = [];
      for (const link of page.hreflangLinks) {
        // A target the crawl never reached can't be judged either way —
        // it might reciprocate fine, we just don't have the data (e.g. it
        // was outside maxDepth/maxPages, or is on a different domain
        // entirely, which hreflang alternates commonly are for
        // language-specific subdomains/ccTLDs).
        const target = pagesByUrl.get(link.url);
        if (!target) continue;
        if (!hasReturnTag(target, page)) {
          missing.push(link);
        }
      }

      const changed =
        missing.length !== page.hreflangMissingReturnTags.length ||
        missing.some((link, index) => {
          const existing = page.hreflangMissingReturnTags[index];
          return existing?.hreflang !== link.hreflang || existing?.url !== link.url;
        });
      if (!changed) continue;

      page.setHreflangMissingReturnTags(missing);
      await this.deps.pageRepository.save(projectId, page);
    }
  }
}
