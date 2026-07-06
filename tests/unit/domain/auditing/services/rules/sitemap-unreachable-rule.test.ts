import { describe, expect, it } from "vitest";
import { sitemapUnreachableRule } from "@/domain/auditing/services/rules/sitemap-unreachable-rule";
import { buildPage } from "../../page-builder";

describe("sitemapUnreachableRule", () => {
  it("flags a page when the site's sitemap.xml is unreachable", () => {
    const findings = sitemapUnreachableRule.evaluate(buildPage({ sitemapIsUnreachable: true }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("technical");
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("does not flag a page when the sitemap is reachable", () => {
    expect(sitemapUnreachableRule.evaluate(buildPage({ sitemapIsUnreachable: false }))).toHaveLength(0);
  });
});
