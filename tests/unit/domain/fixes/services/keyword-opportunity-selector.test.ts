import { describe, expect, it } from "vitest";
import { selectBestOpportunityByPageUrl } from "@/domain/fixes/services/keyword-opportunity-selector";
import { KeywordOpportunity } from "@/domain/tracking/entities/keyword-opportunity";

function opportunity(pageUrl: string, query: string, impressions: number, position: number): KeywordOpportunity {
  return KeywordOpportunity.create("project-1", pageUrl, query, 1, impressions, 0.01, position);
}

describe("selectBestOpportunityByPageUrl", () => {
  it("picks the highest-impression opportunity per page", () => {
    const result = selectBestOpportunityByPageUrl([
      opportunity("https://example.com/a", "low volume query", 20, 10),
      opportunity("https://example.com/a", "high volume query", 500, 15),
    ]);

    expect(result.get("https://example.com/a")?.query).toBe("high volume query");
  });

  it("breaks an impression tie by the better (lower) position", () => {
    const result = selectBestOpportunityByPageUrl([
      opportunity("https://example.com/a", "worse position", 100, 18),
      opportunity("https://example.com/a", "better position", 100, 6),
    ]);

    expect(result.get("https://example.com/a")?.query).toBe("better position");
  });

  it("keeps each page's own best opportunity independent of other pages", () => {
    const result = selectBestOpportunityByPageUrl([
      opportunity("https://example.com/a", "query a", 50, 10),
      opportunity("https://example.com/b", "query b", 999, 5),
    ]);

    expect(result.get("https://example.com/a")?.query).toBe("query a");
    expect(result.get("https://example.com/b")?.query).toBe("query b");
  });

  it("returns an empty map for no opportunities", () => {
    expect(selectBestOpportunityByPageUrl([]).size).toBe(0);
  });
});
