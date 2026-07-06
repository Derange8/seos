// Deliberately not exhaustive against the full schema.org vocabulary
// (800+ types) — that would need a bundled/fetched taxonomy for a very
// niche win. Scoped instead to the types this codebase's own schema
// generator already produces (Organization, BreadcrumbList) plus the
// common ones a real site is likely to hand-author or use a CMS plugin
// for (Article family, FAQPage, Product, LocalBusiness family, Review/
// AggregateRating, Event, Recipe, VideoObject, WebSite, Person). A type
// outside this list is far more likely to be a typo (e.g. "Artical") or a
// made-up value than a legitimate rare schema.org type, given how audit
// findings here get used (a nudge to double-check, not a hard validator).
export const KNOWN_SCHEMA_ORG_TYPES: ReadonlySet<string> = new Set([
  "Thing",
  "Organization",
  "LocalBusiness",
  "Corporation",
  "OnlineBusiness",
  "Person",
  "WebSite",
  "WebPage",
  "BreadcrumbList",
  "ListItem",
  "ItemList",
  "Article",
  "NewsArticle",
  "BlogPosting",
  "TechArticle",
  "FAQPage",
  "QAPage",
  "Question",
  "Answer",
  "HowTo",
  "HowToStep",
  "HowToSection",
  "Product",
  "Offer",
  "AggregateOffer",
  "Review",
  "AggregateRating",
  "Rating",
  "Event",
  "Recipe",
  "NutritionInformation",
  "VideoObject",
  "ImageObject",
  "AudioObject",
  "Brand",
  "Service",
  "SoftwareApplication",
  "MobileApplication",
  "WebApplication",
  "JobPosting",
  "Course",
  "Book",
  "Movie",
  "MusicRecording",
  "MusicAlbum",
  "Place",
  "PostalAddress",
  "GeoCoordinates",
  "ContactPoint",
]);

// "@type" is technically only required to be a JSON-LD *term* — a bare
// word resolves against the default schema.org vocabulary, but it's also
// legal to write a full URI (e.g. "https://schema.org/Organization") or a
// prefixed CURIE. Only the bare-word form is checked against the known
// list; anything containing "/" or ":" is assumed to be an intentional
// full reference and is not flagged, since correctly resolving those
// against arbitrary vocabularies is out of scope.
export function isKnownSchemaOrgType(type: string): boolean {
  if (type.includes("/") || type.includes(":")) return true;
  return KNOWN_SCHEMA_ORG_TYPES.has(type);
}
