import { describe, expect, it } from "vitest";
import { RobotsRules } from "@/domain/crawling/value-objects/robots-rules";

describe("RobotsRules", () => {
  it("allows everything when there's no robots.txt at all", () => {
    const rules = RobotsRules.allowAll();
    expect(rules.isAllowed("/anything")).toBe(true);
    expect(rules.crawlDelaySeconds).toBeNull();
  });

  it("allows everything when no group matches and there's no wildcard group", () => {
    const rules = RobotsRules.parse("User-agent: Googlebot\nDisallow: /private/", "SeosBot");
    expect(rules.isAllowed("/private/page")).toBe(true);
  });

  it("disallows an exact-prefix-matched path under the wildcard group", () => {
    const rules = RobotsRules.parse("User-agent: *\nDisallow: /private/", "SeosBot");
    expect(rules.isAllowed("/private/page")).toBe(false);
    expect(rules.isAllowed("/public/page")).toBe(true);
  });

  it("matches our bot by product token, preferring a specific group over the wildcard group", () => {
    const raw = "User-agent: SeosBot\nDisallow: /no-seos/\n\nUser-agent: *\nDisallow: /no-anyone/";
    const rules = RobotsRules.parse(raw, "SeosBot");
    expect(rules.isAllowed("/no-seos/page")).toBe(false);
    // The wildcard group's rule doesn't apply once a more specific group matched.
    expect(rules.isAllowed("/no-anyone/page")).toBe(true);
  });

  it("merges multiple, non-contiguous 'User-agent: *' blocks instead of only honoring the first (real-world Cloudflare-managed robots.txt shape)", () => {
    const raw = [
      "User-agent: *",
      "Content-Signal: search=yes,ai-train=no",
      "Allow: /",
      "",
      "User-agent: GPTBot",
      "Disallow: /",
      "",
      "User-Agent: *",
      "Allow: /",
      "Disallow: /admin/",
      "Disallow: /api/",
    ].join("\n");
    const rules = RobotsRules.parse(raw, "SeosBot");

    expect(rules.isAllowed("/admin/")).toBe(false);
    expect(rules.isAllowed("/api/")).toBe(false);
    expect(rules.isAllowed("/markets/test")).toBe(true);
  });

  it("supports the * wildcard within a pattern", () => {
    const rules = RobotsRules.parse("User-agent: *\nDisallow: /files/*.pdf", "SeosBot");
    expect(rules.isAllowed("/files/report.pdf")).toBe(false);
    expect(rules.isAllowed("/files/report.csv")).toBe(true);
  });

  it("supports the $ end-anchor", () => {
    const rules = RobotsRules.parse("User-agent: *\nDisallow: /files/report.pdf$", "SeosBot");
    expect(rules.isAllowed("/files/report.pdf")).toBe(false);
    expect(rules.isAllowed("/files/report.pdf.bak")).toBe(true);
  });

  it("an Allow rule overrides a shorter Disallow rule", () => {
    const raw = "User-agent: *\nDisallow: /blog/\nAllow: /blog/public/";
    const rules = RobotsRules.parse(raw, "SeosBot");
    expect(rules.isAllowed("/blog/draft")).toBe(false);
    expect(rules.isAllowed("/blog/public/post")).toBe(true);
  });

  it("an empty Disallow value means nothing is blocked", () => {
    const rules = RobotsRules.parse("User-agent: *\nDisallow:", "SeosBot");
    expect(rules.isAllowed("/anything")).toBe(true);
  });

  it("ignores comments and blank lines", () => {
    const raw = "# robots.txt\nUser-agent: *\n\n# block the admin area\nDisallow: /admin/\n";
    const rules = RobotsRules.parse(raw, "SeosBot");
    expect(rules.isAllowed("/admin/")).toBe(false);
  });

  it("extracts Crawl-delay for the matched group", () => {
    const rules = RobotsRules.parse("User-agent: *\nCrawl-delay: 10", "SeosBot");
    expect(rules.crawlDelaySeconds).toBe(10);
  });

  it("crawlDelaySeconds is null when not specified", () => {
    const rules = RobotsRules.parse("User-agent: *\nDisallow: /admin/", "SeosBot");
    expect(rules.crawlDelaySeconds).toBeNull();
  });
});
