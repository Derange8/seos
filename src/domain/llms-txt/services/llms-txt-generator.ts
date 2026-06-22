import type { Page } from "@/domain/crawling/entities/page";

// llms.txt (https://llmstxt.org) — a markdown file pointing AI/LLM
// crawlers at a site's real, canonical pages with a one-line description
// each, so they can answer questions about the site without having to
// guess from raw HTML. Eligibility mirrors the sitemap's (a real,
// reachable, non-duplicate page) — these are deliberately the same kind of
// "this page truly represents itself" signal, even though sitemap.xml and
// llms.txt serve different audiences (search engines vs. LLMs).
export function isLlmsTxtEligible(page: Page): boolean {
  if (!page.isSuccessful()) return false;
  if (page.canonicalUrl && page.canonicalUrl !== page.url.href) return false;
  return true;
}

function escapeLinkText(value: string): string {
  return value.replace(/\]/g, "\\]");
}

export function renderLlmsTxt(projectName: string, pages: readonly Page[]): string {
  const eligiblePages = [...pages].filter(isLlmsTxtEligible).sort((a, b) => a.url.href.localeCompare(b.url.href));
  const homepage = eligiblePages.find((page) => page.url.pathname === "/");
  const summary = homepage?.metaDescription?.trim() || `${projectName}.`;

  const lines: string[] = [`# ${projectName}`, "", `> ${summary}`, "", "## Pages", ""];

  for (const page of eligiblePages) {
    const title = page.title?.trim() || page.url.href;
    const description = page.metaDescription?.trim();
    lines.push(`- [${escapeLinkText(title)}](${page.url.href})${description ? `: ${description}` : ""}`);
  }

  return `${lines.join("\n")}\n`;
}
