import { describe, expect, it } from "vitest";
import { isLlmsTxtEligible, renderLlmsTxt } from "@/domain/llms-txt/services/llms-txt-generator";
import { Page, type PageAttributes } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";

function url(href: string): Url {
  const result = Url.create(href);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function buildPage(attributes: PageAttributes = {}, href = "https://example.com/"): Page {
  return Page.create("job-1", url(href), attributes);
}

describe("isLlmsTxtEligible", () => {
  it("accepts a successful page with no canonical override", () => {
    expect(isLlmsTxtEligible(buildPage({ statusCode: 200, canonicalUrl: null }))).toBe(true);
  });

  it("rejects a broken page", () => {
    expect(isLlmsTxtEligible(buildPage({ statusCode: 404 }))).toBe(false);
  });

  it("rejects a page that canonicalizes to a different URL", () => {
    expect(
      isLlmsTxtEligible(buildPage({ statusCode: 200, canonicalUrl: "https://example.com/other" }))
    ).toBe(false);
  });
});

describe("renderLlmsTxt", () => {
  it("renders a title, summary from the homepage, and one link per eligible page", () => {
    const home = buildPage({ statusCode: 200, title: "Acme", metaDescription: "Acme builds widgets." });
    const about = buildPage(
      { statusCode: 200, title: "About Acme", metaDescription: "Who we are." },
      "https://example.com/about"
    );
    const broken = buildPage({ statusCode: 404 }, "https://example.com/broken");

    const content = renderLlmsTxt("Acme Inc", [home, about, broken]);

    expect(content).toContain("# Acme Inc");
    expect(content).toContain("> Acme builds widgets.");
    expect(content).toContain("- [Acme](https://example.com/): Acme builds widgets.");
    expect(content).toContain("- [About Acme](https://example.com/about): Who we are.");
    expect(content).not.toContain("/broken");
  });

  it("falls back to the project name when the homepage has no meta description", () => {
    const home = buildPage({ statusCode: 200, title: "Acme", metaDescription: null });

    const content = renderLlmsTxt("Acme Inc", [home]);

    expect(content).toContain("> Acme Inc.");
  });

  it("falls back to the URL as link text when a page has no title", () => {
    const page = buildPage({ statusCode: 200, title: null, metaDescription: null });

    const content = renderLlmsTxt("Acme Inc", [page]);

    expect(content).toContain("- [https://example.com/](https://example.com/)");
  });

  it("renders an empty page list for no eligible pages", () => {
    const content = renderLlmsTxt("Acme Inc", []);

    expect(content).toContain("## Pages");
    expect(content).not.toContain("- [");
  });
});
