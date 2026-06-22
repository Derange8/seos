import { describe, expect, it } from "vitest";
import { generateSchemaMarkup } from "@/domain/schema-markup/services/schema-generator";
import { Page, type PageAttributes } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function buildPage(href: string, attributes: PageAttributes = { statusCode: 200 }): Page {
  return Page.create("job-1", url(href), attributes);
}

describe("generateSchemaMarkup", () => {
  it("generates an Organization schema for the homepage", () => {
    const homepage = buildPage("https://example.com/");

    const markup = generateSchemaMarkup([homepage], "Acme Inc");

    const organization = markup.find((m) => m.type === "Organization");
    expect(organization).toBeDefined();
    expect(organization?.pageId).toBe(homepage.id);
    expect(organization?.jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Acme Inc",
      url: "https://example.com/",
    });
    expect(organization?.source).toBe("rule_based");
    expect(organization?.status).toBe("APPROVED");
  });

  it("does not generate a BreadcrumbList for the homepage itself", () => {
    const homepage = buildPage("https://example.com/");
    const markup = generateSchemaMarkup([homepage], "Acme Inc");
    expect(markup.some((m) => m.type === "BreadcrumbList")).toBe(false);
  });

  it("generates a BreadcrumbList with one item per path segment, plus Home", () => {
    const page = buildPage("https://example.com/blog/my-post");

    const markup = generateSchemaMarkup([page], "Acme Inc");

    const breadcrumb = markup.find((m) => m.type === "BreadcrumbList");
    expect(breadcrumb?.pageId).toBe(page.id);
    expect(breadcrumb?.jsonLd.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://example.com/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://example.com/blog" },
      { "@type": "ListItem", position: 3, name: "My Post", item: "https://example.com/blog/my-post" },
    ]);
  });

  it("excludes pages that did not load successfully", () => {
    const broken = buildPage("https://example.com/missing", { statusCode: 404 });
    const markup = generateSchemaMarkup([broken], "Acme Inc");
    expect(markup).toHaveLength(0);
  });

  it("produces no Organization schema when no homepage was crawled", () => {
    const page = buildPage("https://example.com/about");
    const markup = generateSchemaMarkup([page], "Acme Inc");
    expect(markup.some((m) => m.type === "Organization")).toBe(false);
    expect(markup.some((m) => m.type === "BreadcrumbList")).toBe(true);
  });

  it("generates an FAQPage schema for a page with detected Q&A pairs", () => {
    const page = buildPage("https://example.com/faq", {
      statusCode: 200,
      faqs: [
        { question: "What is Seos?", answer: "An AI SEO platform." },
        { question: "Is there a free plan?", answer: "Yes." },
      ],
    });

    const markup = generateSchemaMarkup([page], "Acme Inc");

    const faqPage = markup.find((m) => m.type === "FAQPage");
    expect(faqPage?.pageId).toBe(page.id);
    expect(faqPage?.jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "What is Seos?", acceptedAnswer: { "@type": "Answer", text: "An AI SEO platform." } },
        { "@type": "Question", name: "Is there a free plan?", acceptedAnswer: { "@type": "Answer", text: "Yes." } },
      ],
    });
    expect(faqPage?.source).toBe("rule_based");
    expect(faqPage?.status).toBe("APPROVED");
  });

  it("produces no FAQPage schema for a page with no detected Q&A pairs", () => {
    const page = buildPage("https://example.com/about");
    const markup = generateSchemaMarkup([page], "Acme Inc");
    expect(markup.some((m) => m.type === "FAQPage")).toBe(false);
  });
});
