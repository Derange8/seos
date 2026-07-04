// Groups pages that are instances of the same route template (e.g.
// /post/1, /post/2, /post/3 -> "/post/[id]") so the dashboard can show one
// summary line ("12 pages affected") instead of 12 separate rows for a
// structural issue that's really one template-level fix. Segment-count
// bucketing plus per-position value comparison, not a hardcoded pattern
// list — works for any site's own route shapes without configuration.
export interface UrlLike {
  pathname: string;
}

function parsePathname(url: string): string[] | null {
  try {
    return new URL(url).pathname.split("/").filter((segment) => segment.length > 0);
  } catch {
    return null;
  }
}

// A segment only counts as an identifier — not a fixed route word like
// "post" or "about" — if it looks like data rather than a hand-written path
// component: purely numeric (IDs), a UUID, a cuid/nanoid-style opaque token
// (long, mixed alphanumeric, no separators — e.g. Prisma's default
// `cmp5rjzww004uv06hpoc8x666` primary keys), or a hyphen/underscore slug.
// Short, all-alphabetic segments ("post", "about", "en") are always
// literal, even in a bucket of otherwise-varying single-segment URLs — two
// unrelated static pages ("/about", "/contact") must never collapse into
// "/[id]" just because they happen to share a segment count.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_PATTERN = /^\d+$/;
// A slug: contains a digit or a separator (hyphen/underscore) alongside
// letters, and is long enough that it's very unlikely to be a short fixed
// route word. "post" (4 chars, no digit/separator) stays literal; "abc-slug"
// or "product-42" count as data.
const SLUG_LIKE_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/i;
// An opaque token: no separators, but long enough (16+ chars) and containing
// both a letter and a digit — no hand-written route segment is realistically
// this long AND this mixed. Cuid ("cmp5rjz...", 25 chars), nanoid, and
// similar auto-generated IDs all match; short fixed words like "post" or
// "profile" (max a few chars, no digits) never do.
const OPAQUE_TOKEN_PATTERN = /^(?=.*[a-z])(?=.*\d)[a-z0-9]{16,}$/i;

function looksLikeIdentifier(segment: string): boolean {
  return (
    NUMERIC_PATTERN.test(segment) ||
    UUID_PATTERN.test(segment) ||
    SLUG_LIKE_PATTERN.test(segment) ||
    OPAQUE_TOKEN_PATTERN.test(segment)
  );
}

// Groups URLs by segment count first — "/post/1" and "/post/1/comments"
// are different shapes, comparing them position-by-position would produce
// a nonsensical template. Within a same-length group, a position is
// templated only if its values actually differ across the group AND at
// least one of those values looks like an identifier — so "/about" next to
// "/contact" (same length, both literal words, no id-shaped value) is left
// alone instead of collapsing into a meaningless "/[id]".
export function deriveRouteTemplates(urls: readonly string[]): ReadonlyMap<string, string> {
  const bySegmentCount = new Map<number, { url: string; segments: string[] }[]>();

  for (const url of urls) {
    const segments = parsePathname(url);
    if (segments === null) continue;
    const bucket = bySegmentCount.get(segments.length);
    if (bucket) bucket.push({ url, segments });
    else bySegmentCount.set(segments.length, [{ url, segments }]);
  }

  const templateByUrl = new Map<string, string>();

  for (const bucket of bySegmentCount.values()) {
    if (bucket.length === 0) continue;
    const segmentCount = bucket[0]!.segments.length;

    const templated: boolean[] = [];
    for (let i = 0; i < segmentCount; i++) {
      const values = bucket.map((entry) => entry.segments[i]!);
      const varies = values.some((value) => value !== values[0]);
      templated.push(varies && values.some(looksLikeIdentifier));
    }

    for (const entry of bucket) {
      const template =
        "/" + entry.segments.map((segment, i) => (templated[i] ? "[id]" : segment)).join("/");
      templateByUrl.set(entry.url, segmentCount === 0 ? "/" : template);
    }
  }

  return templateByUrl;
}
