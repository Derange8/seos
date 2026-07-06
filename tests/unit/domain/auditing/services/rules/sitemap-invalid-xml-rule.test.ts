import { describe, expect, it } from "vitest";
import { sitemapInvalidXmlRule } from "@/domain/auditing/services/rules/sitemap-invalid-xml-rule";
import { buildPage } from "../../page-builder";

describe("sitemapInvalidXmlRule", () => {
  it("flags a page when the site's sitemap.xml is not valid XML", () => {
    const findings = sitemapInvalidXmlRule.evaluate(buildPage({ sitemapIsInvalidXml: true }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("technical");
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("does not flag a page when the sitemap is valid XML", () => {
    expect(sitemapInvalidXmlRule.evaluate(buildPage({ sitemapIsInvalidXml: false }))).toHaveLength(0);
  });

  it("does not flag a page when the sitemap couldn't be fetched at all (null)", () => {
    expect(sitemapInvalidXmlRule.evaluate(buildPage({ sitemapIsInvalidXml: null }))).toHaveLength(0);
  });
});
