import { describe, expect, it } from "vitest";
import {
  analyzeSitemapXml,
  robotsBlocksEntireSite,
  robotsHasSitemapDirective,
} from "@/domain/auditing/services/robots-sitemap-analysis";

describe("robotsBlocksEntireSite", () => {
  it("detects a bare 'Disallow: /' under User-agent: *", () => {
    const raw = "User-agent: *\nDisallow: /\n";
    expect(robotsBlocksEntireSite(raw)).toBe(true);
  });

  it("does not flag a robots.txt that only blocks a specific named bot, not '*'", () => {
    // A deliberate, common, harmless pattern: opt a site out of AI
    // training/scraping for a named bot while still allowing real search
    // engines via the wildcard group.
    const raw = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n";
    expect(robotsBlocksEntireSite(raw)).toBe(false);
  });

  it("matches janus.vote's real production robots.txt shape (Cloudflare AI-bot block list + a permissive wildcard group) without a false positive", () => {
    const raw = `
      User-agent: *
      Content-Signal: search=yes,ai-train=no,use=reference
      Allow: /

      User-agent: Amazonbot
      Disallow: /

      User-agent: GPTBot
      Disallow: /

      User-agent: ClaudeBot
      Disallow: /

      User-Agent: *
      Allow: /
      Disallow: /admin
      Disallow: /api/

      Sitemap: https://example.com/sitemap.xml
    `;
    expect(robotsBlocksEntireSite(raw)).toBe(false);
  });

  it("does not flag a normal robots.txt that only disallows specific paths", () => {
    const raw = "User-agent: *\nDisallow: /admin/\nDisallow: /wp-admin/\n";
    expect(robotsBlocksEntireSite(raw)).toBe(false);
  });

  it("does not flag 'Disallow:' with an empty value (means 'block nothing')", () => {
    const raw = "User-agent: *\nDisallow:\n";
    expect(robotsBlocksEntireSite(raw)).toBe(false);
  });

  it("does not flag a group where an explicit 'Allow: /' follows the disallow", () => {
    const raw = "User-agent: *\nDisallow: /\nAllow: /\n";
    expect(robotsBlocksEntireSite(raw)).toBe(false);
  });

  it("detects it when the wildcard group blocks everything even alongside an unrelated named-bot group", () => {
    const raw = "User-agent: Googlebot\nDisallow: /private/\n\nUser-agent: *\nDisallow: /\n";
    expect(robotsBlocksEntireSite(raw)).toBe(true);
  });

  it("returns false for an empty robots.txt", () => {
    expect(robotsBlocksEntireSite("")).toBe(false);
  });
});

describe("robotsHasSitemapDirective", () => {
  it("detects a Sitemap directive", () => {
    const raw = "User-agent: *\nDisallow:\nSitemap: https://example.com/sitemap.xml\n";
    expect(robotsHasSitemapDirective(raw)).toBe(true);
  });

  it("is case-insensitive", () => {
    const raw = "user-agent: *\nsitemap: https://example.com/sitemap.xml\n";
    expect(robotsHasSitemapDirective(raw)).toBe(true);
  });

  it("returns false when there is no Sitemap directive", () => {
    const raw = "User-agent: *\nDisallow: /admin/\n";
    expect(robotsHasSitemapDirective(raw)).toBe(false);
  });
});

describe("analyzeSitemapXml", () => {
  it("accepts a well-formed sitemap and counts its URLs", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/</loc></url>
        <url><loc>https://example.com/about</loc></url>
      </urlset>`;
    const result = analyzeSitemapXml(xml);
    expect(result.isValid).toBe(true);
    expect(result.urlCount).toBe(2);
  });

  it("accepts a valid but empty sitemap", () => {
    const xml = `<?xml version="1.0"?><urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;
    const result = analyzeSitemapXml(xml);
    expect(result.isValid).toBe(true);
    expect(result.urlCount).toBe(0);
  });

  it("rejects a truncated/unbalanced document", () => {
    const xml = `<urlset><url><loc>https://example.com/</loc>`;
    expect(analyzeSitemapXml(xml).isValid).toBe(false);
  });

  it("rejects an HTML error page served instead of XML", () => {
    const html = `<html><body>404 Not Found</body></html>`;
    expect(analyzeSitemapXml(html).isValid).toBe(false);
  });

  it("rejects a completely empty response", () => {
    expect(analyzeSitemapXml("").isValid).toBe(false);
  });

  it("tolerates a self-closing tag without miscounting it as unbalanced", () => {
    const xml = `<urlset xmlns="x"><url><loc/></url></urlset>`;
    expect(analyzeSitemapXml(xml).isValid).toBe(true);
  });

  it("recognizes a sitemap index root, not just urlset", () => {
    const xml = `<sitemapindex><sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap></sitemapindex>`;
    expect(analyzeSitemapXml(xml).isValid).toBe(true);
  });
});
