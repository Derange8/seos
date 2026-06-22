import type { DomainName } from "@/domain/projects/value-objects/domain-name";

// v1: always allow full crawling — there's no Project setting yet for
// disallowed paths, so there's nothing to restrict. The Sitemap directive
// points at the conventional default location; this tool generates sitemap
// content for the owner to upload there themselves (see sitemap generator),
// it doesn't host it live on their domain.
export function renderRobotsTxt(domain: DomainName): string {
  return `User-agent: *\nAllow: /\n\nSitemap: https://${domain.value}/sitemap.xml\n`;
}
