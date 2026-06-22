import type { Url } from "@/domain/crawling/value-objects/url";
import type { Faq } from "@/domain/crawling/entities/page";

export interface ParsedPageContent {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  wordCount: number;
  // Hash of the visible text (not raw HTML) — Crawler Engine design §3:
  // whitespace/comment differences in markup shouldn't register as distinct
  // content when checking for duplicates.
  contentHash: string;
  // First couple hundred characters of the visible text — not the whole
  // body (that would bloat storage for no benefit), just enough for the
  // fix engine to derive a meta description from real page content.
  contentExcerpt: string | null;
  // Raw, absolute href strings resolved against baseUrl. Validating them
  // into Url value objects is the caller's job (a malformed href shouldn't
  // fail parsing the rest of the page).
  links: readonly string[];
  // Heading-then-answer pairs detected from existing page structure (any
  // h2-h6 whose text ends in "?", paired with the text of the elements
  // immediately following it up to the next heading) — not LLM-generated,
  // just surfacing a Q&A pattern the page already has so FAQPage schema can
  // be built from it. A page with no such structure simply has none.
  faqs: readonly Faq[];
  // Whether the page already ships at least one valid JSON-LD block
  // (<script type="application/ld+json">) — existence only, not which
  // @type or whether it validates against schema.org. Feeds the
  // missing-structured-data audit rule.
  hasStructuredData: boolean;
  // Count of <img> elements with no alt attribute at all — alt="" is a
  // deliberate "decorative, skip me" signal per WAI-ARIA and doesn't count.
  // Feeds the missing-image-alt audit rule.
  imagesMissingAltCount: number;
  // Count of sub-resources (img/script/stylesheet/iframe/audio/video/source)
  // loaded over plain HTTP from an HTTPS page — the browser-flagged "mixed
  // content" case. Always 0 for an HTTP page itself. Feeds the
  // mixed-content audit rule.
  mixedContentCount: number;
  // Total count of <h1> elements on the page (h1 above only keeps the
  // first one's text). A page should have exactly one — 0 is already
  // covered by missing-h1-rule, 2+ feeds the multiple-h1 rule.
  h1Count: number;
  // Total count of <link rel="canonical"> elements, regardless of whether
  // their href is valid (canonicalUrl above only keeps the first one,
  // resolved). 2+ canonical tags on one page is ambiguous/invalid per
  // spec and a common plugin-conflict bug. Feeds the multiple-canonical
  // audit rule.
  canonicalTagCount: number;
  // Whether <meta name="robots"> declares "noindex" — the page has asked
  // search engines to exclude it from results. Often intentional, but a
  // classic, costly mistake when it isn't. Feeds the noindex audit rule.
  isNoindex: boolean;
}

export interface HtmlParserPort {
  parse(html: string, baseUrl: Url): ParsedPageContent;
}
