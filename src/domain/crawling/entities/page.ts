import type { Link } from "@/domain/crawling/entities/link";
import type { Url } from "@/domain/crawling/value-objects/url";

export interface Faq {
  question: string;
  answer: string;
}

export interface PageAttributes {
  statusCode?: number | null;
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  canonicalUrl?: string | null;
  contentHash?: string | null;
  wordCount?: number | null;
  // A short prefix of the page's visible text — kept around (unlike the
  // rest of the body, which is only ever hashed) specifically so the fix
  // engine has real material to derive a meta description from, instead
  // of guessing from a title alone.
  contentExcerpt?: string | null;
  // Heading-derived Q&A pairs (see Faq) — empty, not null, when the page
  // has none; FAQPage schema generation just checks length.
  faqs?: readonly Faq[];
  // Time-to-fully-fetch, in milliseconds (see PageFetchResult.responseTimeMs)
  // — a server-response-time signal, not a full Core Web Vitals
  // measurement (no LCP/CLS/INP here), but it's a real, already-measured
  // number rather than a fabricated one. Feeds the slow-response-time rule.
  responseTimeMs?: number | null;
  // Whether the page already ships valid JSON-LD structured data (see
  // ParsedPageContent.hasStructuredData). Feeds the missing-structured-data
  // rule.
  hasStructuredData?: boolean;
  // Every "@type" found across the page's valid JSON-LD blocks (see
  // ParsedPageContent.structuredDataTypes). Feeds the
  // unrecognized-structured-data-type rule.
  structuredDataTypes?: readonly string[];
  // Whether a JSON-LD block on the page failed to parse (see
  // ParsedPageContent.hasInvalidStructuredData). Feeds the
  // invalid-structured-data rule.
  hasInvalidStructuredData?: boolean;
  // Count of <img> elements with no alt attribute (see
  // ParsedPageContent.imagesMissingAltCount). Feeds the missing-image-alt
  // rule.
  imagesMissingAltCount?: number;
  // Each hop the crawler followed before reaching this page (see
  // PageFetchResult.redirectChain) — empty if the URL resolved directly,
  // with no redirect at all. A single redirect (length 1) is normal; 2+
  // is a chain, which is what the redirect-chain rule actually flags.
  redirectChain?: readonly string[];
  // Count of HTTP sub-resources loaded from an HTTPS page (see
  // ParsedPageContent.mixedContentCount). Feeds the mixed-content rule.
  mixedContentCount?: number;
  // Whether another page in the same crawl job shares this exact title/
  // meta description — computed post-crawl by
  // DetectDuplicateContentUseCase (cross-page, doesn't fit the per-page
  // AuditRule interface), not at parse time. Feeds duplicate-title-rule /
  // duplicate-meta-description-rule.
  hasDuplicateTitle?: boolean;
  hasDuplicateMetaDescription?: boolean;
  // Whether another page in the same crawl job has the exact same visible
  // text (see Page.contentHash) — also computed by
  // DetectDuplicateContentUseCase. Excludes pages with no real content
  // (wordCount 0), since two empty pages aren't "duplicate content" so
  // much as both individually thin — that's thin-content-rule's job.
  hasDuplicateContent?: boolean;
  // Total count of <h1> elements (see ParsedPageContent.h1Count). Feeds
  // the multiple-h1 rule.
  h1Count?: number;
  // Total count of <link rel="canonical"> elements (see
  // ParsedPageContent.canonicalTagCount). Feeds the multiple-canonical
  // rule.
  canonicalTagCount?: number;
  // Whether <meta name="robots"> declares "noindex" (see
  // ParsedPageContent.isNoindex). Feeds the noindex rule.
  isNoindex?: boolean;
  // Whether no other page in the crawl job links to this one internally —
  // computed post-crawl by DetectOrphanPagesUseCase (cross-page, like
  // hasDuplicateTitle above). The crawl's root page is never orphaned by
  // definition, even though nothing within the crawl links to it either.
  isOrphan?: boolean;
  // Raw Content-Security-Policy response header (see PageFetchResult.cspHeader),
  // null when the page sent none. Feeds the csp-blocks-script rule.
  cspHeader?: string | null;
  // Cross-origin <script src> origins the page references (see
  // ParsedPageContent.externalScriptOrigins). Feeds the csp-blocks-script
  // rule, paired with cspHeader.
  externalScriptOrigins?: readonly string[];
  // wordCount from the plain HTTP-fetched HTML, captured separately from
  // the (possibly Playwright-rendered) wordCount above — only populated
  // when CrawlConfig.deepCsrCheck is on (see ProcessPageTaskUseCase). Null
  // means "not measured this crawl", not "zero raw content". Feeds
  // client-side-only-content-rule, paired with wordCount as the rendered
  // side of the comparison.
  rawWordCount?: number | null;
  // Whether this page's real content only exists after client-side JS
  // executes — i.e. rawWordCount is near-empty while the rendered
  // wordCount is substantial (see ProcessPageTaskUseCase for the actual
  // threshold/ratio). Distinct from thin-content: thin-content means the
  // page genuinely has little content; this means Googlebot may see
  // little content even though a browser sees plenty. Always false when
  // rawWordCount wasn't measured (deepCsrCheck off).
  isClientSideOnlyContent?: boolean;
  // Whether the site's live robots.txt disallows "/" (the entire site) for
  // at least one User-agent group — computed post-crawl by
  // AuditRobotsAndSitemapUseCase (site-level, not really "about" this page,
  // but every AuditIssue needs a pageId — see that use case for why it's
  // attached to the crawl's root page specifically). Always false when not
  // yet computed (e.g. an old Page row from before this field existed).
  // Feeds the robots-blocks-entire-site rule.
  robotsBlocksEntireSite?: boolean;
  // Whether the site's live robots.txt exists but has no "Sitemap:"
  // directive pointing search engines at the sitemap. Feeds the
  // robots-missing-sitemap-directive rule. Null means "no robots.txt was
  // found at all" (a separate, already-covered case — a missing file isn't
  // a missing directive within a file that exists).
  robotsMissingSitemapDirective?: boolean | null;
  // Whether the site's live sitemap.xml could not be fetched at all (404
  // or network error). Feeds the sitemap-unreachable rule.
  sitemapIsUnreachable?: boolean;
  // Whether the site's live sitemap.xml was fetched but isn't well-formed
  // XML. Null when the sitemap couldn't be fetched in the first place
  // (sitemapIsUnreachable already covers that case). Feeds the
  // sitemap-invalid-xml rule.
  sitemapIsInvalidXml?: boolean | null;
}

export interface PageProps extends Required<PageAttributes> {
  id: string;
  crawlJobId: string;
  url: Url;
  crawledAt: Date;
}

export class Page {
  private readonly links: Link[] = [];

  private constructor(private readonly props: PageProps) {}

  static create(crawlJobId: string, url: Url, attributes: PageAttributes = {}): Page {
    return new Page({
      id: crypto.randomUUID(),
      crawlJobId,
      url,
      crawledAt: new Date(),
      statusCode: attributes.statusCode ?? null,
      title: attributes.title ?? null,
      metaDescription: attributes.metaDescription ?? null,
      h1: attributes.h1 ?? null,
      canonicalUrl: attributes.canonicalUrl ?? null,
      contentHash: attributes.contentHash ?? null,
      wordCount: attributes.wordCount ?? null,
      contentExcerpt: attributes.contentExcerpt ?? null,
      faqs: attributes.faqs ?? [],
      responseTimeMs: attributes.responseTimeMs ?? null,
      hasStructuredData: attributes.hasStructuredData ?? false,
      structuredDataTypes: attributes.structuredDataTypes ?? [],
      hasInvalidStructuredData: attributes.hasInvalidStructuredData ?? false,
      imagesMissingAltCount: attributes.imagesMissingAltCount ?? 0,
      redirectChain: attributes.redirectChain ?? [],
      mixedContentCount: attributes.mixedContentCount ?? 0,
      hasDuplicateTitle: attributes.hasDuplicateTitle ?? false,
      hasDuplicateMetaDescription: attributes.hasDuplicateMetaDescription ?? false,
      hasDuplicateContent: attributes.hasDuplicateContent ?? false,
      h1Count: attributes.h1Count ?? 0,
      canonicalTagCount: attributes.canonicalTagCount ?? 0,
      isNoindex: attributes.isNoindex ?? false,
      isOrphan: attributes.isOrphan ?? false,
      cspHeader: attributes.cspHeader ?? null,
      externalScriptOrigins: attributes.externalScriptOrigins ?? [],
      rawWordCount: attributes.rawWordCount ?? null,
      isClientSideOnlyContent: attributes.isClientSideOnlyContent ?? false,
      robotsBlocksEntireSite: attributes.robotsBlocksEntireSite ?? false,
      robotsMissingSitemapDirective: attributes.robotsMissingSitemapDirective ?? null,
      sitemapIsUnreachable: attributes.sitemapIsUnreachable ?? false,
      sitemapIsInvalidXml: attributes.sitemapIsInvalidXml ?? null,
    });
  }

  static reconstitute(props: PageProps, links: readonly Link[] = []): Page {
    const page = new Page(props);
    for (const link of links) {
      page.addLink(link);
    }
    return page;
  }

  get id(): string {
    return this.props.id;
  }

  get crawlJobId(): string {
    return this.props.crawlJobId;
  }

  get url(): Url {
    return this.props.url;
  }

  get statusCode(): number | null {
    return this.props.statusCode;
  }

  get title(): string | null {
    return this.props.title;
  }

  get metaDescription(): string | null {
    return this.props.metaDescription;
  }

  get h1(): string | null {
    return this.props.h1;
  }

  get canonicalUrl(): string | null {
    return this.props.canonicalUrl;
  }

  get contentHash(): string | null {
    return this.props.contentHash;
  }

  get wordCount(): number | null {
    return this.props.wordCount;
  }

  get contentExcerpt(): string | null {
    return this.props.contentExcerpt;
  }

  get faqs(): readonly Faq[] {
    return this.props.faqs;
  }

  get responseTimeMs(): number | null {
    return this.props.responseTimeMs;
  }

  get hasStructuredData(): boolean {
    return this.props.hasStructuredData;
  }

  get structuredDataTypes(): readonly string[] {
    return this.props.structuredDataTypes;
  }

  get hasInvalidStructuredData(): boolean {
    return this.props.hasInvalidStructuredData;
  }

  get imagesMissingAltCount(): number {
    return this.props.imagesMissingAltCount;
  }

  get redirectChain(): readonly string[] {
    return this.props.redirectChain;
  }

  get mixedContentCount(): number {
    return this.props.mixedContentCount;
  }

  get hasDuplicateTitle(): boolean {
    return this.props.hasDuplicateTitle;
  }

  get hasDuplicateMetaDescription(): boolean {
    return this.props.hasDuplicateMetaDescription;
  }

  get hasDuplicateContent(): boolean {
    return this.props.hasDuplicateContent;
  }

  // Recomputed wholesale on every DetectDuplicateContentUseCase run (unlike
  // Link.markBroken's one-way transition) — duplicates can resolve
  // themselves between crawls, so this needs to be settable both ways.
  setDuplicateFlags(
    hasDuplicateTitle: boolean,
    hasDuplicateMetaDescription: boolean,
    hasDuplicateContent: boolean
  ): void {
    this.props.hasDuplicateTitle = hasDuplicateTitle;
    this.props.hasDuplicateMetaDescription = hasDuplicateMetaDescription;
    this.props.hasDuplicateContent = hasDuplicateContent;
  }

  get h1Count(): number {
    return this.props.h1Count;
  }

  get canonicalTagCount(): number {
    return this.props.canonicalTagCount;
  }

  get isNoindex(): boolean {
    return this.props.isNoindex;
  }

  get isOrphan(): boolean {
    return this.props.isOrphan;
  }

  get cspHeader(): string | null {
    return this.props.cspHeader;
  }

  get externalScriptOrigins(): readonly string[] {
    return this.props.externalScriptOrigins;
  }

  get rawWordCount(): number | null {
    return this.props.rawWordCount;
  }

  get isClientSideOnlyContent(): boolean {
    return this.props.isClientSideOnlyContent;
  }

  get robotsBlocksEntireSite(): boolean {
    return this.props.robotsBlocksEntireSite;
  }

  get robotsMissingSitemapDirective(): boolean | null {
    return this.props.robotsMissingSitemapDirective;
  }

  get sitemapIsUnreachable(): boolean {
    return this.props.sitemapIsUnreachable;
  }

  get sitemapIsInvalidXml(): boolean | null {
    return this.props.sitemapIsInvalidXml;
  }

  // Recomputed wholesale on every AuditRobotsAndSitemapUseCase run, same
  // rationale as setDuplicateFlags/setOrphan — a site's robots.txt/sitemap
  // can change between crawls.
  setRobotsAndSitemapFlags(flags: {
    robotsBlocksEntireSite: boolean;
    robotsMissingSitemapDirective: boolean | null;
    sitemapIsUnreachable: boolean;
    sitemapIsInvalidXml: boolean | null;
  }): void {
    this.props.robotsBlocksEntireSite = flags.robotsBlocksEntireSite;
    this.props.robotsMissingSitemapDirective = flags.robotsMissingSitemapDirective;
    this.props.sitemapIsUnreachable = flags.sitemapIsUnreachable;
    this.props.sitemapIsInvalidXml = flags.sitemapIsInvalidXml;
  }

  // Same rationale as setDuplicateFlags: recomputed wholesale on every
  // DetectOrphanPagesUseCase run, not a one-way transition — a page can
  // gain or lose its only internal link between crawls.
  setOrphan(isOrphan: boolean): void {
    this.props.isOrphan = isOrphan;
  }

  get crawledAt(): Date {
    return this.props.crawledAt;
  }

  get allLinks(): readonly Link[] {
    return this.links;
  }

  addLink(link: Link): void {
    this.links.push(link);
  }

  isSuccessful(): boolean {
    return this.statusCode !== null && this.statusCode >= 200 && this.statusCode < 300;
  }

  isBroken(): boolean {
    return this.statusCode !== null && this.statusCode >= 400;
  }
}
