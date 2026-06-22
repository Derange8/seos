import type { Page } from "@/domain/crawling/entities/page";

export interface SitemapEntry {
  url: string;
  lastModified: Date;
}

const SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9";

// A page belongs in the sitemap only if it's a real, reachable page — not
// a redirect/error — and not a duplicate that canonicalizes to a different
// URL (whichever page *is* that canonical URL, if it was crawled, already
// represents it).
export function isSitemapEligible(page: Page): boolean {
  if (!page.isSuccessful()) return false;
  if (page.canonicalUrl && page.canonicalUrl !== page.url.href) return false;
  return true;
}

// crawledAt stands in for "last modified" — the fetcher doesn't currently
// capture the Last-Modified response header, so this is the closest proxy
// available; good enough for a freshness signal at v1.
export function selectSitemapEntries(pages: readonly Page[]): SitemapEntry[] {
  return pages.filter(isSitemapEligible).map((page) => ({
    url: page.url.href,
    lastModified: page.crawledAt,
  }));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Sitemap protocol (https://www.sitemaps.org/protocol.html) — only <loc>
// and <lastmod> are emitted; <priority>/<changefreq> have long been ignored
// by major search engines and we have no reliable signal for them anyway.
// The 50,000-URL/50MB per-file cap and sitemap-index splitting are deferred
// — not a concern until crawls regularly exceed that, which the default
// maxPages (200) is nowhere near.
export function renderSitemapXml(entries: readonly SitemapEntry[]): string {
  const urls = entries
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(entry.url)}</loc>\n    <lastmod>${entry.lastModified
          .toISOString()
          .slice(0, 10)}</lastmod>\n  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${SITEMAP_NAMESPACE}">\n${urls}\n</urlset>\n`;
}
