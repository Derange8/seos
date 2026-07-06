import { describe, expect, it } from "vitest";
import { robotsMissingSitemapDirectiveRule } from "@/domain/auditing/services/rules/robots-missing-sitemap-directive-rule";
import { buildPage } from "../../page-builder";

describe("robotsMissingSitemapDirectiveRule", () => {
  it("flags a page when robots.txt exists but has no Sitemap directive", () => {
    const findings = robotsMissingSitemapDirectiveRule.evaluate(
      buildPage({ robotsMissingSitemapDirective: true })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("technical");
    expect(findings[0]?.severity).toBe("INFO");
  });

  it("does not flag a page when robots.txt has a Sitemap directive", () => {
    expect(
      robotsMissingSitemapDirectiveRule.evaluate(buildPage({ robotsMissingSitemapDirective: false }))
    ).toHaveLength(0);
  });

  it("does not flag a page when there is no robots.txt at all (null)", () => {
    expect(
      robotsMissingSitemapDirectiveRule.evaluate(buildPage({ robotsMissingSitemapDirective: null }))
    ).toHaveLength(0);
  });
});
