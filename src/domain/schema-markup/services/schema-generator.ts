import type { Page } from "@/domain/crawling/entities/page";
import { SchemaMarkup } from "@/domain/schema-markup/entities/schema-markup";

const SCHEMA_CONTEXT = "https://schema.org";

function isHomepage(page: Page): boolean {
  return page.url.pathname === "/";
}

function humanizeSegment(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // Leave malformed percent-encoding as-is rather than throwing — this is
    // a cosmetic breadcrumb label, not something worth failing generation
    // over.
  }
  return decoded.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildBreadcrumbList(page: Page): Record<string, unknown> {
  const segments = page.url.pathname.split("/").filter(Boolean);
  const itemListElement: Record<string, unknown>[] = [
    { "@type": "ListItem", position: 1, name: "Home", item: `${page.url.origin}/` },
  ];

  let pathSoFar = "";
  segments.forEach((segment, index) => {
    pathSoFar += `/${segment}`;
    itemListElement.push({
      "@type": "ListItem",
      position: index + 2,
      name: humanizeSegment(segment),
      item: `${page.url.origin}${pathSoFar}`,
    });
  });

  return { "@context": SCHEMA_CONTEXT, "@type": "BreadcrumbList", itemListElement };
}

function buildOrganization(homepage: Page, organizationName: string): Record<string, unknown> {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    name: organizationName,
    url: `${homepage.url.origin}/`,
  };
}

function buildFaqPage(page: Page): Record<string, unknown> {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

// Rule-based only — Organization (site identity, attached to whichever
// crawled page is the homepage), BreadcrumbList (derived from URL path
// structure, one per non-homepage page), and FAQPage (one per page that
// already has heading-derived Q&A pairs — see Faq on the Page entity).
// Article is deferred: unlike FAQ detection (a page either has Q&A-shaped
// headings or it doesn't), "is this page an article, and what's it about"
// needs real content understanding that structure alone can't give —
// guessing from word count or URL shape alone would misfire on plenty of
// non-article pages, so it's left for a future AI-backed pass (see
// SchemaMarkup's own doc comment) rather than shipped as a heuristic.
export function generateSchemaMarkup(pages: readonly Page[], organizationName: string): SchemaMarkup[] {
  const eligiblePages = pages.filter((page) => page.isSuccessful());
  const markup: SchemaMarkup[] = [];

  const homepage = eligiblePages.find(isHomepage);
  if (homepage) {
    markup.push(SchemaMarkup.createRuleBased(homepage.id, "Organization", buildOrganization(homepage, organizationName)));
  }

  for (const page of eligiblePages) {
    // A breadcrumb list of just "Home" carries no information; skip it.
    if (!isHomepage(page)) {
      markup.push(SchemaMarkup.createRuleBased(page.id, "BreadcrumbList", buildBreadcrumbList(page)));
    }

    if (page.faqs.length > 0) {
      markup.push(SchemaMarkup.createRuleBased(page.id, "FAQPage", buildFaqPage(page)));
    }
  }

  return markup;
}
