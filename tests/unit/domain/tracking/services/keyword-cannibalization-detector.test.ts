import { describe, expect, it } from "vitest";
import { detectKeywordCannibalization } from "@/domain/tracking/services/keyword-cannibalization-detector";
import type { PageQueryPerformance } from "@/application/tracking/ports/search-console-client-port";

function row(overrides: Partial<PageQueryPerformance> = {}): PageQueryPerformance {
  return {
    page: "https://example.com/a",
    query: "widgets",
    clicks: 5,
    impressions: 50,
    ctr: 0.1,
    position: 8,
    ...overrides,
  };
}

describe("detectKeywordCannibalization", () => {
  it("flags a query with two distinct pages both above the impression threshold", () => {
    const issues = detectKeywordCannibalization("project-1", [
      row({ page: "https://example.com/a", impressions: 100 }),
      row({ page: "https://example.com/b", impressions: 50 }),
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0].query).toBe("widgets");
    expect(issues[0].pages.map((p) => p.pageUrl)).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("sorts competing pages most-impressions-first", () => {
    const issues = detectKeywordCannibalization("project-1", [
      row({ page: "https://example.com/a", impressions: 20 }),
      row({ page: "https://example.com/b", impressions: 200 }),
    ]);

    expect(issues[0].pages[0].pageUrl).toBe("https://example.com/b");
    expect(issues[0].pages[1].pageUrl).toBe("https://example.com/a");
  });

  it("does not flag a query with only one page", () => {
    const issues = detectKeywordCannibalization("project-1", [
      row({ page: "https://example.com/a", impressions: 100 }),
    ]);

    expect(issues).toHaveLength(0);
  });

  it("ignores a page whose impressions fall below the noise threshold", () => {
    const issues = detectKeywordCannibalization("project-1", [
      row({ page: "https://example.com/a", impressions: 100 }),
      row({ page: "https://example.com/b", impressions: 2 }),
    ]);

    expect(issues).toHaveLength(0);
  });

  it("keeps queries independent — a shared page across two different queries isn't cannibalization", () => {
    const issues = detectKeywordCannibalization("project-1", [
      row({ page: "https://example.com/a", query: "widgets", impressions: 100 }),
      row({ page: "https://example.com/a", query: "gadgets", impressions: 100 }),
    ]);

    expect(issues).toHaveLength(0);
  });

  it("flags 3+ pages competing for the same query as a single issue", () => {
    const issues = detectKeywordCannibalization("project-1", [
      row({ page: "https://example.com/a", impressions: 30 }),
      row({ page: "https://example.com/b", impressions: 20 }),
      row({ page: "https://example.com/c", impressions: 10 }),
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0].pages).toHaveLength(3);
  });

  it("returns nothing for an empty input", () => {
    expect(detectKeywordCannibalization("project-1", [])).toHaveLength(0);
  });

  it("stamps every issue with the given projectId", () => {
    const issues = detectKeywordCannibalization("project-42", [
      row({ page: "https://example.com/a", impressions: 100 }),
      row({ page: "https://example.com/b", impressions: 50 }),
    ]);

    expect(issues[0].projectId).toBe("project-42");
  });
});
