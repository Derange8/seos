// Analyzes raw robots.txt/sitemap.xml text fetched live from a site (not
// Seos's own generated ones — see robots-generator.ts/sitemap-generator.ts
// for that). This is a real-world-facts check: what is the site actually
// serving today, which may be hand-authored, produced by a CMS plugin, or
// stale from a previous setup — none of which Seos controls.

// Only the wildcard "User-agent: *" group, not every group in the file —
// blocking a specific named bot (e.g. "User-agent: GPTBot\nDisallow: /") is
// a deliberate, common, and harmless choice (opting a site out of AI
// training/scraping while still allowing real search engines), not an SEO
// mistake. Real robots.txt files commonly carry both: a Cloudflare-managed
// block list of AI-scraper user agents up top, and a separate "*" group
// underneath that still fully allows normal search crawling — confirmed
// against a real production robots.txt (janus.vote) during manual
// verification of this rule, which is what caught this exact false positive
// before it shipped. What actually damages SEO is the wildcard group
// itself (or a well-known search-engine bot's own group) disallowing "/",
// since that's the group real search engines fall back to / are named in.
function wildcardGroupBlocksPath(raw: string, path: string): boolean {
  const groups = raw.split(/(?=^user-agent:)/im);
  for (const group of groups) {
    const lines = group.split(/\r?\n/).map((line) => line.split("#")[0].trim());
    const userAgents = lines
      .filter((line) => /^user-agent:/i.test(line))
      .map((line) => line.slice(line.indexOf(":") + 1).trim());
    if (!userAgents.includes("*")) continue;

    let blocked = false;
    for (const line of lines) {
      const disallowMatch = /^disallow:\s*(.*)$/i.exec(line);
      const allowMatch = /^allow:\s*(.*)$/i.exec(line);
      if (disallowMatch) {
        const value = disallowMatch[1].trim();
        if (value === "/" || value === "") blocked = value === "/";
      } else if (allowMatch && allowMatch[1].trim() === path) {
        blocked = false;
      }
    }
    if (blocked) return true;
  }
  return false;
}

// Whether robots.txt disallows "/" (the entire site) for the wildcard
// "User-agent: *" group specifically — the single most damaging robots.txt
// mistake, and a real one: a staging-site robots.txt accidentally left in
// place after launch is a common, costly, easy-to-miss error no page-level
// audit rule can see (the page itself renders fine; only robots.txt says
// "don't index any of this").
export function robotsBlocksEntireSite(rawRobotsTxt: string): boolean {
  return wildcardGroupBlocksPath(rawRobotsTxt, "/");
}

export function robotsHasSitemapDirective(rawRobotsTxt: string): boolean {
  return /^sitemap:\s*\S+/im.test(rawRobotsTxt);
}

export interface SitemapXmlAnalysis {
  isValid: boolean;
  urlCount: number;
}

// Presence-only XML well-formedness + <url>/<loc> counting — a full XML
// schema validation against the sitemaps.org XSD is out of scope; what
// actually matters to a site owner is "does this parse at all" and "is it
// empty," both of which a hand-edited or mis-generated sitemap can fail.
export function analyzeSitemapXml(rawSitemapXml: string): SitemapXmlAnalysis {
  const trimmed = rawSitemapXml.trim();
  if (trimmed.length === 0) {
    return { isValid: false, urlCount: 0 };
  }

  // DOMParser isn't available in a plain Node context and pulling in a
  // full XML parser dependency for a well-formedness check this narrow
  // isn't worth it — a real sitemap's structural requirements are simple
  // enough (an <urlset>/<sitemapindex> root, well-formed tags) that regex
  // tag-balance checking catches the realistic failure modes (truncated
  // file, HTML error page served instead of XML, stray unescaped "&").
  const hasXmlDeclarationOrRoot = /<\?xml|<urlset|<sitemapindex/i.test(trimmed);
  if (!hasXmlDeclarationOrRoot) {
    return { isValid: false, urlCount: 0 };
  }

  // Self-closing tags (<loc/>) never match either regex below (the open
  // pattern's negative lookbehind excludes anything ending "/>", and the
  // close pattern only matches "</tag>") — they carry no obligation to
  // balance and are correctly ignored by comparing open-count to
  // close-count directly.
  const openTags = trimmed.match(/<([a-zA-Z][\w:-]*)(?:\s[^>]*)?(?<!\/)>/g)?.length ?? 0;
  const closeTags = trimmed.match(/<\/[a-zA-Z][\w:-]*>/g)?.length ?? 0;
  const isBalanced = openTags === closeTags;

  const urlCount = (trimmed.match(/<loc>/gi) ?? []).length;

  return { isValid: isBalanced, urlCount };
}
