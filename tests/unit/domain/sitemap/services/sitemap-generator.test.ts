import { describe, expect, it } from "vitest";
import {
  isSitemapEligible,
  renderSitemapXml,
  selectSitemapEntries,
} from "@/domain/sitemap/services/sitemap-generator";
import { Page, type PageAttributes } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";

function url(href: string): Url {
  const result = Url.create(href);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function buildPage(attributes: PageAttributes = {}, href = "https://example.com/"): Page {
  return Page.create("job-1", url(href), attributes);
}

describe("isSitemapEligible", () => {
  it("accepts a successful page with no canonical override", () => {
    expect(isSitemapEligible(buildPage({ statusCode: 200, canonicalUrl: null }))).toBe(true);
  });

  it("accepts a page whose canonical points at itself", () => {
    expect(
      isSitemapEligible(buildPage({ statusCode: 200, canonicalUrl: "https://example.com/" }))
    ).toBe(true);
  });

  it("rejects a broken page", () => {
    expect(isSitemapEligible(buildPage({ statusCode: 404 }))).toBe(false);
  });

  it("rejects a page with no recorded status code", () => {
    expect(isSitemapEligible(buildPage({ statusCode: null }))).toBe(false);
  });

  it("rejects a page that canonicalizes to a different URL", () => {
    expect(
      isSitemapEligible(buildPage({ statusCode: 200, canonicalUrl: "https://example.com/other" }))
    ).toBe(false);
  });
});

describe("selectSitemapEntries", () => {
  it("filters out ineligible pages and maps the rest to entries", () => {
    const crawledAt = new Date("2026-01-01T00:00:00Z");
    const eligible = Page.reconstitute(
      {
        id: "page-1",
        crawlJobId: "job-1",
        url: url("https://example.com/"),
        crawledAt,
        statusCode: 200,
        title: null,
        metaDescription: null,
        h1: null,
        canonicalUrl: null,
        contentHash: null,
        wordCount: null,
        contentExcerpt: null,
        faqs: [],
        responseTimeMs: null,
        hasStructuredData: false,
        imagesMissingAltCount: 0,
        redirectChain: [],
        mixedContentCount: 0,
        hasDuplicateTitle: false,
        hasDuplicateMetaDescription: false,
        hasDuplicateContent: false,
        h1Count: 0,
        canonicalTagCount: 0,
        isNoindex: false,
        isOrphan: false,
        cspHeader: null,
        externalScriptOrigins: [],
      },
      []
    );
    const broken = buildPage({ statusCode: 500 }, "https://example.com/broken");

    const entries = selectSitemapEntries([eligible, broken]);

    expect(entries).toEqual([{ url: "https://example.com/", lastModified: crawledAt }]);
  });
});

describe("renderSitemapXml", () => {
  it("renders a valid urlset with loc and lastmod for each entry", () => {
    const xml = renderSitemapXml([
      { url: "https://example.com/", lastModified: new Date("2026-01-01T00:00:00Z") },
      { url: "https://example.com/about", lastModified: new Date("2026-01-02T00:00:00Z") },
    ]);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://example.com/</loc>");
    expect(xml).toContain("<lastmod>2026-01-01</lastmod>");
    expect(xml).toContain("<loc>https://example.com/about</loc>");
    expect(xml).toContain("<lastmod>2026-01-02</lastmod>");
  });

  it("escapes XML special characters in the URL", () => {
    const xml = renderSitemapXml([
      { url: "https://example.com/?a=1&b=2", lastModified: new Date("2026-01-01T00:00:00Z") },
    ]);

    expect(xml).toContain("<loc>https://example.com/?a=1&amp;b=2</loc>");
  });

  it("renders an empty urlset for no entries", () => {
    const xml = renderSitemapXml([]);
    expect(xml).toContain("<urlset");
    expect(xml).not.toContain("<url>");
  });
});
