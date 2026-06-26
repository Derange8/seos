import { describe, expect, it } from "vitest";
import { PageContentDraft } from "@/domain/content-enrichment/entities/page-content-draft";
import { renderDraftContentHtml } from "@/domain/content-enrichment/services/render-draft-html";

describe("renderDraftContentHtml", () => {
  it("renders body sections as h2/p pairs", () => {
    const draft = PageContentDraft.create(
      "project-1",
      "https://example.com/about",
      "Title",
      "Meta",
      [
        { heading: "First section", content: "First content" },
        { heading: "Second section", content: "Second content" },
      ],
      []
    );

    const html = renderDraftContentHtml(draft);

    expect(html).toBe(
      "<h2>First section</h2>\n<p>First content</p>\n\n<h2>Second section</h2>\n<p>Second content</p>"
    );
  });

  it("appends an FAQ section as h3/p pairs under its own FAQ heading", () => {
    const draft = PageContentDraft.create(
      "project-1",
      "https://example.com/about",
      "Title",
      "Meta",
      [{ heading: "Section", content: "Content" }],
      [{ question: "How does it work?", answer: "Like this." }]
    );

    const html = renderDraftContentHtml(draft);

    expect(html).toBe(
      "<h2>Section</h2>\n<p>Content</p>\n\n<h2>FAQ</h2>\n\n<h3>How does it work?</h3>\n<p>Like this.</p>"
    );
  });

  it("escapes HTML-significant characters in headings, content, and FAQ text", () => {
    const draft = PageContentDraft.create(
      "project-1",
      "https://example.com/about",
      "Title",
      "Meta",
      [{ heading: "<script>alert(1)</script>", content: "A & B < C" }],
      [{ question: "<b>Q</b>?", answer: "A > B" }]
    );

    const html = renderDraftContentHtml(draft);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B &lt; C");
    expect(html).toContain("&lt;b&gt;Q&lt;/b&gt;");
    expect(html).toContain("A &gt; B");
  });

  it("renders just the FAQ heading with no body sections", () => {
    const draft = PageContentDraft.create("project-1", "https://example.com/about", "Title", "Meta", [], [
      { question: "Q?", answer: "A." },
    ]);

    const html = renderDraftContentHtml(draft);

    expect(html).toBe("<h2>FAQ</h2>\n\n<h3>Q?</h3>\n<p>A.</p>");
  });
});
