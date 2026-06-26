import { describe, expect, it } from "vitest";
import { PageContentDraft } from "@/domain/content-enrichment/entities/page-content-draft";
import { isErr, isOk } from "@/shared/result";

function draft(): PageContentDraft {
  return PageContentDraft.create(
    "project-1",
    "https://example.com/about",
    "A Generated Title",
    "A generated meta description",
    [{ heading: "Section", content: "Body" }],
    [{ question: "Q?", answer: "A." }]
  );
}

describe("PageContentDraft", () => {
  it("starts out DRAFT with no previous values", () => {
    const d = draft();
    expect(d.status).toBe("DRAFT");
    expect(d.previousTitle).toBeNull();
    expect(d.previousMetaDescription).toBeNull();
    expect(d.previousContent).toBeNull();
  });

  it("markPublished() transitions DRAFT -> PUBLISHED and captures previous values", () => {
    const d = draft();
    const result = d.markPublished("Old Title", "Old description", "<p>Old content</p>");
    expect(isOk(result)).toBe(true);
    expect(d.status).toBe("PUBLISHED");
    expect(d.previousTitle).toBe("Old Title");
    expect(d.previousMetaDescription).toBe("Old description");
    expect(d.previousContent).toBe("<p>Old content</p>");
  });

  it("markPublished() fails when already PUBLISHED", () => {
    const d = draft();
    d.markPublished("Old Title", "Old description", "<p>Old content</p>");

    const result = d.markPublished("Another Old Title", "Another description", "<p>Another</p>");

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe("INVALID_PAGE_CONTENT_DRAFT_STATE");
    expect(d.previousTitle).toBe("Old Title");
  });

  it("markFailed() transitions DRAFT -> FAILED", () => {
    const d = draft();
    const result = d.markFailed();
    expect(isOk(result)).toBe(true);
    expect(d.status).toBe("FAILED");
  });

  it("markPublished() succeeds from FAILED (retry after a failed attempt)", () => {
    const d = draft();
    d.markFailed();

    const result = d.markPublished("Old Title", "Old description", "<p>Old content</p>");

    expect(isOk(result)).toBe(true);
    expect(d.status).toBe("PUBLISHED");
  });

  it("markFailed() fails when already PUBLISHED", () => {
    const d = draft();
    d.markPublished("Old Title", "Old description", "<p>Old content</p>");

    const result = d.markFailed();

    expect(isErr(result)).toBe(true);
    expect(d.status).toBe("PUBLISHED");
  });

  it("revert() transitions PUBLISHED -> DRAFT and clears previous values", () => {
    const d = draft();
    d.markPublished("Old Title", "Old description", "<p>Old content</p>");

    const result = d.revert();

    expect(isOk(result)).toBe(true);
    expect(d.status).toBe("DRAFT");
    expect(d.previousTitle).toBeNull();
    expect(d.previousMetaDescription).toBeNull();
    expect(d.previousContent).toBeNull();
  });

  it("revert() fails when not currently PUBLISHED", () => {
    const d = draft();

    const result = d.revert();

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.code).toBe("INVALID_PAGE_CONTENT_DRAFT_STATE");
  });
});
