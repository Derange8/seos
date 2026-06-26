import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { HtmlParserPort, ParsedPageContent } from "@/application/crawling/ports/html-parser-port";
import type { Faq } from "@/domain/crawling/entities/page";
import type { Url } from "@/domain/crawling/value-objects/url";

// Long enough to give the growth-analysis LLM call (which reasons about a
// whole page's content — pricing, FAQ presence, claims) real material to
// work with, not just a meta-description-length snippet. The meta-
// description fix generator already truncates further as needed, so a
// larger excerpt only ever helps it, never hurts.
export const EXCERPT_LENGTH = 1500;
// normalizeWhitespace (below) collapses any run of whitespace — including
// multiple inserted newlines — down to a single space, so there's no
// downside to covering every closing tag here rather than hand-picking
// "block" ones: missing a tag (e.g. a nav built from bare <a>/<button>
// with no <li> wrapper) is exactly what let "Keşfet" and "Canlı" glue
// together into "KeşfetCanlı" with no separator at all.
const BLOCK_CLOSING_TAGS = /<\/[a-zA-Z][a-zA-Z0-9]*>/g;
const FAQ_HEADING_SELECTOR = "h2, h3, h4, h5, h6";
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";
const MAX_FAQ_ANSWER_LENGTH = 500;
const MAX_FAQS_PER_PAGE = 20;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// cheerio's .text() concatenates block-level elements with no separator
// (e.g. "<h1>Title</h1><p>Body</p>" becomes "TitleBody") — visible text
// reads fine on screen because the browser renders block boundaries as
// line breaks, but that boundary is lost once it's flattened to a string.
// Forcing a newline after each block tag before extracting text keeps
// word count/hash/excerpt from running words together.
//
// Unlike a browser's innerText, cheerio's .text() does NOT skip <script>/
// <style> content — it's parsing markup, not rendering it. A page with a
// JSON-LD <script> in <body> (a common place to put it) would otherwise
// leak that raw JSON into wordCount/contentHash/contentExcerpt, corrupting
// thin-content/duplicate-content detection and the meta-description fix
// generator (which reads contentExcerpt). Removed from a clone, not the
// shared $ document — detectStructuredData() below still needs the real
// <script type="application/ld+json"> tags intact.
//
// <nav>/<footer> are excluded too — they're chrome repeated on every page
// of a site (nav links, search shortcut, copyright line), not page-specific
// content. Left in, they (a) inflate wordCount enough to mask genuinely
// thin pages, (b) dilute contentHash so real duplicate-content goes
// undetected on short pages, and (c) get sliced straight into the
// meta-description fix suggestion via contentExcerpt, producing a
// suggestion that's mostly nav text. <header> is deliberately NOT excluded
// — on many sites it wraps a page-specific hero/intro, not just chrome.
function extractVisibleText($: cheerio.CheerioAPI): string {
  const bodyClone = $("body").clone();
  bodyClone.find("script, style, noscript, nav, footer").remove();
  const bodyHtml = bodyClone.html() ?? "";
  const withBreaks = bodyHtml.replace(BLOCK_CLOSING_TAGS, "$&\n");
  return cheerio.load(withBreaks)("body").text();
}

// Headings ending in "?" are treated as candidate FAQ questions; the
// answer is whatever non-heading content immediately follows, up to the
// next heading (or MAX_FAQ_ANSWER_LENGTH, whichever comes first) — a
// heading with nothing but other headings after it (or nothing at all)
// isn't a real FAQ entry, so it's dropped rather than recorded empty.
function extractFaqs($: cheerio.CheerioAPI): Faq[] {
  const faqs: Faq[] = [];

  $(FAQ_HEADING_SELECTOR).each((_index, element) => {
    if (faqs.length >= MAX_FAQS_PER_PAGE) return;

    const question = normalizeWhitespace($(element).text());
    if (!question.endsWith("?")) return;

    const answerParts: string[] = [];
    let sibling = $(element).next();
    while (sibling.length > 0 && !sibling.is(HEADING_SELECTOR)) {
      const text = normalizeWhitespace(sibling.text());
      if (text) answerParts.push(text);
      sibling = sibling.next();
    }

    const answer = answerParts.join(" ").slice(0, MAX_FAQ_ANSWER_LENGTH);
    if (answer.length > 0) {
      faqs.push({ question, answer });
    }
  });

  return faqs;
}

// Presence only: a script tag that parses as JSON counts, regardless of
// shape — actually validating against schema.org types is a much bigger
// scope than "does this page have any structured data at all."
function detectStructuredData($: cheerio.CheerioAPI): boolean {
  let found = false;
  $('script[type="application/ld+json"]').each((_index, element) => {
    if (found) return;
    const raw = $(element).contents().text().trim();
    if (raw.length === 0) return;
    try {
      JSON.parse(raw);
      found = true;
    } catch {
      // malformed JSON-LD doesn't count as "has structured data"
    }
  });
  return found;
}

// alt="" is a deliberate accessibility signal ("decorative image, skip me")
// per WAI-ARIA, not a violation — only a fully missing attribute counts.
function countImagesMissingAlt($: cheerio.CheerioAPI): number {
  let count = 0;
  $("img").each((_index, element) => {
    if ($(element).attr("alt") === undefined) count += 1;
  });
  return count;
}

function resolveHref(href: string | undefined, baseUrl: Url): string | null {
  if (!href) return null;
  try {
    return new URL(href, baseUrl.href).href;
  } catch {
    return null;
  }
}

const MIXED_CONTENT_SELECTOR =
  "img[src], script[src], link[rel='stylesheet'][href], iframe[src], audio[src], video[src], source[src]";

// Only meaningful on an HTTPS page loading a sub-resource over plain HTTP
// — the browser-flagged "mixed content" case. Protocol-relative URLs
// (//host/path) resolve to the page's own scheme via resolveHref's
// new URL(href, baseUrl), so they correctly never count here.
function countMixedContentResources($: cheerio.CheerioAPI, baseUrl: Url): number {
  if (new URL(baseUrl.href).protocol !== "https:") return 0;

  let count = 0;
  $(MIXED_CONTENT_SELECTOR).each((_index, element) => {
    const raw = $(element).attr("src") ?? $(element).attr("href");
    const resolved = resolveHref(raw, baseUrl);
    if (resolved && new URL(resolved).protocol === "http:") count += 1;
  });
  return count;
}

// Origin = scheme + host[:port], no path — that's the granularity a CSP
// script-src source list actually matches against. A same-origin script
// (no src, or src resolving to baseUrl's own origin) is never blocked by
// the page's own CSP, so it's deliberately excluded here.
function extractExternalScriptOrigins($: cheerio.CheerioAPI, baseUrl: Url): string[] {
  const ownOrigin = new URL(baseUrl.href).origin;
  const origins = new Set<string>();
  $("script[src]").each((_index, element) => {
    const resolved = resolveHref($(element).attr("src"), baseUrl);
    if (!resolved) return;
    const origin = new URL(resolved).origin;
    if (origin !== ownOrigin) origins.add(origin);
  });
  return Array.from(origins);
}

// Directives are comma-separated (e.g. "noindex, nofollow") — splitting and
// trimming each one avoids a false negative against "noindexfoo" while
// still matching regardless of surrounding whitespace or casing.
function detectNoindex($: cheerio.CheerioAPI): boolean {
  const content = $('meta[name="robots"]').first().attr("content");
  if (!content) return false;
  return content
    .split(",")
    .map((directive) => directive.trim().toLowerCase())
    .includes("noindex");
}

export class CheerioHtmlParser implements HtmlParserPort {
  parse(html: string, baseUrl: Url): ParsedPageContent {
    const $ = cheerio.load(html);

    const title = normalizeWhitespace($("title").first().text()) || null;
    const metaDescription = $('meta[name="description"]').first().attr("content")?.trim() || null;
    const h1 = normalizeWhitespace($("h1").first().text()) || null;
    const canonicalUrl = resolveHref($('link[rel="canonical"]').first().attr("href"), baseUrl);

    const visibleText = normalizeWhitespace(extractVisibleText($));
    const wordCount = visibleText.length === 0 ? 0 : visibleText.split(" ").length;
    const contentHash = createHash("sha256").update(visibleText).digest("hex");
    const contentExcerpt = visibleText.length === 0 ? null : visibleText.slice(0, EXCERPT_LENGTH);

    const links = new Set<string>();
    $("a[href]").each((_index, element) => {
      const resolved = resolveHref($(element).attr("href"), baseUrl);
      if (resolved) links.add(resolved);
    });

    return {
      title,
      metaDescription,
      h1,
      canonicalUrl,
      wordCount,
      contentHash,
      contentExcerpt,
      links: Array.from(links),
      faqs: extractFaqs($),
      hasStructuredData: detectStructuredData($),
      imagesMissingAltCount: countImagesMissingAlt($),
      mixedContentCount: countMixedContentResources($, baseUrl),
      h1Count: $("h1").length,
      canonicalTagCount: $('link[rel="canonical"]').length,
      isNoindex: detectNoindex($),
      externalScriptOrigins: extractExternalScriptOrigins($, baseUrl),
    };
  }
}
