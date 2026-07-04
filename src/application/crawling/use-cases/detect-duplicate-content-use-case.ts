import type { Page } from "@/domain/crawling/entities/page";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";

export interface DetectDuplicateContentDeps {
  pageRepository: PageRepositoryPort;
}

function normalize(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.toLowerCase();
}

// Pages with no title/meta description at all aren't "duplicates of each
// other" — that's already missing-title-rule/missing-meta-description-
// rule's job. Only non-empty values that repeat across 2+ pages count.
function findDuplicatedValues(pages: readonly Page[], getValue: (page: Page) => string | null): Set<string> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const value = normalize(getValue(page));
    if (value === null) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const duplicated = new Set<string>();
  for (const [value, count] of counts) {
    if (count > 1) duplicated.add(value);
  }
  return duplicated;
}

// A page that declares a canonical URL other than itself is explicitly
// telling search engines "the other URL is the one that counts, ignore me
// for ranking/indexing purposes" — e.g. ?tab= query-param variants of the
// same route all canonicalizing to "/". That's already the resolved state
// duplicate-title/meta-description/content exist to surface, so such pages
// are excluded from being flagged (they still count toward another page's
// duplicate count if that other page does NOT self-canonicalize away).
function selfCanonicalizes(page: Page): boolean {
  if (!page.canonicalUrl) return true;
  return page.canonicalUrl === page.url.href;
}

// Cross-page comparison — same reason this can't be a plain AuditRule as
// DetectBrokenLinksUseCase: a single-page rule has no way to know what any
// *other* page's title/meta description is. Runs once per crawl job,
// before RunAuditUseCase (see crawl-pipeline.ts's CrawlJobCompleted
// handler order), so duplicate-title-rule/duplicate-meta-description-rule
// can stay plain single-page rules that just read the flag this sets.
export class DetectDuplicateContentUseCase {
  constructor(private readonly deps: DetectDuplicateContentDeps) {}

  async execute(projectId: string, crawlJobId: string): Promise<void> {
    const pages = await this.deps.pageRepository.findAllByCrawlJobId(crawlJobId);
    // Pages that canonicalize away to a different URL are excluded from the
    // comparison pool entirely, not just from being flagged themselves —
    // otherwise the page they point to would still get flagged as a
    // "duplicate" of a variant it has already resolved via canonical.
    const comparablePages = pages.filter(selfCanonicalizes);

    const duplicatedTitles = findDuplicatedValues(comparablePages, (page) => page.title);
    const duplicatedMetaDescriptions = findDuplicatedValues(comparablePages, (page) => page.metaDescription);
    // wordCount 0 (no real visible text) is excluded so two empty pages
    // don't count as "duplicate content" — that's thin-content-rule's job.
    const duplicatedContent = findDuplicatedValues(comparablePages, (page) =>
      page.wordCount && page.wordCount > 0 ? page.contentHash : null
    );

    for (const page of pages) {
      const canonicalizesAway = !selfCanonicalizes(page);
      const hasDuplicateTitle =
        !canonicalizesAway && normalize(page.title) !== null && duplicatedTitles.has(normalize(page.title)!);
      const hasDuplicateMetaDescription =
        !canonicalizesAway &&
        normalize(page.metaDescription) !== null &&
        duplicatedMetaDescriptions.has(normalize(page.metaDescription)!);
      const hasDuplicateContent =
        !canonicalizesAway &&
        !!page.wordCount &&
        page.wordCount > 0 &&
        duplicatedContent.has(normalize(page.contentHash)!);

      if (
        hasDuplicateTitle === page.hasDuplicateTitle &&
        hasDuplicateMetaDescription === page.hasDuplicateMetaDescription &&
        hasDuplicateContent === page.hasDuplicateContent
      ) {
        continue;
      }

      page.setDuplicateFlags(hasDuplicateTitle, hasDuplicateMetaDescription, hasDuplicateContent);
      await this.deps.pageRepository.save(projectId, page);
    }
  }
}
