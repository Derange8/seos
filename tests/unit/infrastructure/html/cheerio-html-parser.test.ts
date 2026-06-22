import { describe, expect, it } from "vitest";
import { CheerioHtmlParser } from "@/infrastructure/html/cheerio-html-parser";
import { Url } from "@/domain/crawling/value-objects/url";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("CheerioHtmlParser", () => {
  const parser = new CheerioHtmlParser();
  const baseUrl = url("https://example.com/blog/post");

  it("extracts title, meta description, h1, and canonical", () => {
    const html = `
      <html>
        <head>
          <title>  My Post  </title>
          <meta name="description" content="A great post">
          <link rel="canonical" href="/blog/post">
        </head>
        <body><h1>My Post Heading</h1><p>Some content here.</p></body>
      </html>
    `;

    const result = parser.parse(html, baseUrl);

    expect(result.title).toBe("My Post");
    expect(result.metaDescription).toBe("A great post");
    expect(result.h1).toBe("My Post Heading");
    expect(result.canonicalUrl).toBe("https://example.com/blog/post");
  });

  it("resolves relative links against the base URL and dedupes them", () => {
    const html = `
      <body>
        <a href="/about">About</a>
        <a href="https://example.com/about">About again</a>
        <a href="contact">Contact</a>
        <a href="https://other.com/">External</a>
      </body>
    `;

    const result = parser.parse(html, baseUrl);

    expect(result.links).toContain("https://example.com/about");
    expect(result.links).toContain("https://example.com/blog/contact");
    expect(result.links).toContain("https://other.com/");
    expect(result.links).toHaveLength(3);
  });

  it("ignores malformed hrefs without failing the whole parse", () => {
    const html = `<body><a href="http://[::1">Bad</a><a href="/ok">Ok</a></body>`;
    const result = parser.parse(html, baseUrl);
    expect(result.links).toEqual(["https://example.com/ok"]);
  });

  it("computes word count and a stable content hash from visible text only", () => {
    const htmlA = `<body><!-- comment --><p>Hello   world</p></body>`;
    const htmlB = `<body><p>Hello world</p></body>`;

    const resultA = parser.parse(htmlA, baseUrl);
    const resultB = parser.parse(htmlB, baseUrl);

    expect(resultA.wordCount).toBe(2);
    expect(resultA.contentHash).toBe(resultB.contentHash);
  });

  it("inserts a word boundary between adjacent block elements instead of running them together", () => {
    const html = "<body><h1>Example Domain</h1><p>This domain is for use in examples.</p></body>";
    const result = parser.parse(html, baseUrl);
    expect(result.contentExcerpt).toBe("Example Domain This domain is for use in examples.");
  });

  it("returns nulls/empty values for a page with none of these elements", () => {
    const result = parser.parse("<html><body></body></html>", baseUrl);
    expect(result.title).toBeNull();
    expect(result.metaDescription).toBeNull();
    expect(result.h1).toBeNull();
    expect(result.canonicalUrl).toBeNull();
    expect(result.wordCount).toBe(0);
    expect(result.links).toEqual([]);
    expect(result.contentExcerpt).toBeNull();
  });

  it("captures a short excerpt of the visible text for the fix engine to use later", () => {
    const result = parser.parse("<body><p>This is the real page content.</p></body>", baseUrl);
    expect(result.contentExcerpt).toBe("This is the real page content.");
  });

  it("truncates the excerpt rather than keeping the whole body", () => {
    const longText = "word ".repeat(200).trim();
    const result = parser.parse(`<body><p>${longText}</p></body>`, baseUrl);
    expect(result.contentExcerpt?.length).toBeLessThanOrEqual(300);
    expect(result.contentExcerpt?.length).toBeLessThan(longText.length);
  });

  describe("hasStructuredData", () => {
    it("is true when the page has a valid JSON-LD block", () => {
      const html = `<head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Seos"}</script></head><body></body>`;
      expect(parser.parse(html, baseUrl).hasStructuredData).toBe(true);
    });

    it("is false when there's no JSON-LD at all", () => {
      expect(parser.parse("<body><p>No structured data here.</p></body>", baseUrl).hasStructuredData).toBe(false);
    });

    it("is false when the JSON-LD block is malformed", () => {
      const html = `<script type="application/ld+json">{not valid json}</script>`;
      expect(parser.parse(html, baseUrl).hasStructuredData).toBe(false);
    });

    it("is false for an empty JSON-LD block", () => {
      const html = `<script type="application/ld+json"></script>`;
      expect(parser.parse(html, baseUrl).hasStructuredData).toBe(false);
    });
  });

  describe("imagesMissingAltCount", () => {
    it("counts images with no alt attribute at all", () => {
      const html = `<body><img src="a.png"><img src="b.png" alt="A photo"><img src="c.png"></body>`;
      expect(parser.parse(html, baseUrl).imagesMissingAltCount).toBe(2);
    });

    it("does not count an image with an empty alt as missing (decorative, per WAI-ARIA)", () => {
      const html = `<body><img src="a.png" alt=""></body>`;
      expect(parser.parse(html, baseUrl).imagesMissingAltCount).toBe(0);
    });

    it("is zero for a page with no images", () => {
      expect(parser.parse("<body><p>No images here.</p></body>", baseUrl).imagesMissingAltCount).toBe(0);
    });
  });

  describe("mixedContentCount", () => {
    it("counts an http image on an https page", () => {
      const html = `<body><img src="http://example.com/photo.png"></body>`;
      expect(parser.parse(html, baseUrl).mixedContentCount).toBe(1);
    });

    it("counts an http script and an http stylesheet separately", () => {
      const html = `
        <head><link rel="stylesheet" href="http://example.com/style.css"></head>
        <body><script src="http://example.com/app.js"></script></body>
      `;
      expect(parser.parse(html, baseUrl).mixedContentCount).toBe(2);
    });

    it("does not count an https resource", () => {
      const html = `<body><img src="https://example.com/photo.png"></body>`;
      expect(parser.parse(html, baseUrl).mixedContentCount).toBe(0);
    });

    it("does not count a protocol-relative resource (inherits the page's own https scheme)", () => {
      const html = `<body><img src="//example.com/photo.png"></body>`;
      expect(parser.parse(html, baseUrl).mixedContentCount).toBe(0);
    });

    it("is always zero on an http page itself", () => {
      const httpBaseUrl = url("http://example.com/blog/post");
      const html = `<body><img src="http://example.com/photo.png"></body>`;
      expect(parser.parse(html, httpBaseUrl).mixedContentCount).toBe(0);
    });
  });

  describe("h1Count", () => {
    it("counts every h1 element, not just the first", () => {
      const html = `<body><h1>One</h1><h1>Two</h1></body>`;
      expect(parser.parse(html, baseUrl).h1Count).toBe(2);
    });

    it("is zero when there is no h1", () => {
      expect(parser.parse("<body><p>No heading.</p></body>", baseUrl).h1Count).toBe(0);
    });
  });

  describe("canonicalTagCount", () => {
    it("counts every canonical link tag, not just the first", () => {
      const html = `
        <head>
          <link rel="canonical" href="https://example.com/a">
          <link rel="canonical" href="https://example.com/b">
        </head>
      `;
      expect(parser.parse(html, baseUrl).canonicalTagCount).toBe(2);
    });

    it("is zero when there is no canonical tag", () => {
      expect(parser.parse("<head></head>", baseUrl).canonicalTagCount).toBe(0);
    });
  });

  describe("isNoindex", () => {
    it("detects a bare noindex directive", () => {
      const html = `<head><meta name="robots" content="noindex"></head>`;
      expect(parser.parse(html, baseUrl).isNoindex).toBe(true);
    });

    it("detects noindex combined with other directives", () => {
      const html = `<head><meta name="robots" content="noindex, nofollow"></head>`;
      expect(parser.parse(html, baseUrl).isNoindex).toBe(true);
    });

    it("is false when the robots meta tag is absent", () => {
      expect(parser.parse("<head></head>", baseUrl).isNoindex).toBe(false);
    });

    it("is false for index,follow", () => {
      const html = `<head><meta name="robots" content="index, follow"></head>`;
      expect(parser.parse(html, baseUrl).isNoindex).toBe(false);
    });
  });

  describe("faqs", () => {
    it("pairs a heading ending in '?' with the text that follows it", () => {
      const html = `
        <body>
          <h2>What is Seos?</h2>
          <p>Seos is an AI SEO platform.</p>
          <h2>How much does it cost?</h2>
          <p>Pricing varies by plan.</p>
        </body>
      `;
      const result = parser.parse(html, baseUrl);

      expect(result.faqs).toEqual([
        { question: "What is Seos?", answer: "Seos is an AI SEO platform." },
        { question: "How much does it cost?", answer: "Pricing varies by plan." },
      ]);
    });

    it("stops collecting the answer at the next heading", () => {
      const html = `
        <body>
          <h2>What is Seos?</h2>
          <p>Seos is an AI SEO platform.</p>
          <h2>Another section</h2>
          <p>Unrelated content.</p>
        </body>
      `;
      const result = parser.parse(html, baseUrl);

      expect(result.faqs).toEqual([{ question: "What is Seos?", answer: "Seos is an AI SEO platform." }]);
    });

    it("ignores headings that don't end in a question mark", () => {
      const html = "<body><h2>About us</h2><p>We build things.</p></body>";
      const result = parser.parse(html, baseUrl);
      expect(result.faqs).toEqual([]);
    });

    it("drops a question heading with no following content", () => {
      const html = "<body><h2>What is Seos?</h2></body>";
      const result = parser.parse(html, baseUrl);
      expect(result.faqs).toEqual([]);
    });

    it("returns an empty array for a page with no headings", () => {
      const result = parser.parse("<body><p>Just a paragraph.</p></body>", baseUrl);
      expect(result.faqs).toEqual([]);
    });
  });
});
