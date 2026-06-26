import { describe, expect, it } from "vitest";
import { detectCtrUnderperformers } from "@/domain/tracking/services/ctr-underperformer-detector";
import type { PageQueryPerformance } from "@/application/tracking/ports/search-console-client-port";

function row(overrides: Partial<PageQueryPerformance> = {}): PageQueryPerformance {
  return {
    page: "https://example.com/a",
    query: "widgets",
    clicks: 10,
    impressions: 100,
    ctr: 0.1,
    position: 2,
    ...overrides,
  };
}

describe("detectCtrUnderperformers", () => {
  it("flags a top-ranking query whose CTR is far below this site's own average at that rank", () => {
    const rows = [
      row({ query: "widgets", position: 2, ctr: 0.3, impressions: 100 }),
      row({ query: "gadgets", position: 2, ctr: 0.28, impressions: 100 }),
      row({ query: "doohickeys", position: 2, ctr: 0.05, impressions: 100 }),
    ];

    const issues = detectCtrUnderperformers("project-1", rows);

    expect(issues).toHaveLength(1);
    expect(issues[0].query).toBe("doohickeys");
    expect(issues[0].expectedCtr).toBeCloseTo((0.3 + 0.28 + 0.05) / 3, 5);
  });

  it("does not flag a query whose CTR is close to the site's average at that rank", () => {
    const rows = [
      row({ query: "widgets", position: 2, ctr: 0.3, impressions: 100 }),
      row({ query: "gadgets", position: 2, ctr: 0.25, impressions: 100 }),
    ];

    expect(detectCtrUnderperformers("project-1", rows)).toHaveLength(0);
  });

  it("ignores queries ranked outside the top position threshold", () => {
    const rows = [
      row({ query: "widgets", position: 8, ctr: 0.3, impressions: 100 }),
      row({ query: "gadgets", position: 8, ctr: 0.01, impressions: 100 }),
    ];

    expect(detectCtrUnderperformers("project-1", rows)).toHaveLength(0);
  });

  it("ignores rows below the minimum impressions floor", () => {
    const rows = [
      row({ query: "widgets", position: 2, ctr: 0.3, impressions: 100 }),
      row({ query: "gadgets", position: 2, ctr: 0.01, impressions: 5 }),
    ];

    expect(detectCtrUnderperformers("project-1", rows)).toHaveLength(0);
  });

  it("does not flag the only query at a given rank — there's nothing to compare it against", () => {
    const rows = [row({ query: "widgets", position: 2, ctr: 0.01, impressions: 100 })];

    expect(detectCtrUnderperformers("project-1", rows)).toHaveLength(0);
  });

  it("compares against other queries at the same rounded position, not other ranks", () => {
    const rows = [
      row({ query: "widgets", position: 1, ctr: 0.4, impressions: 100 }),
      row({ query: "gadgets", position: 1, ctr: 0.38, impressions: 100 }),
      // Same low CTR, but position 5 has a much lower expected baseline —
      // shouldn't be compared against position 1's average.
      row({ query: "doohickeys", position: 5, ctr: 0.05, impressions: 100 }),
      row({ query: "thingamajigs", position: 5, ctr: 0.04, impressions: 100 }),
    ];

    expect(detectCtrUnderperformers("project-1", rows)).toHaveLength(0);
  });

  it("returns nothing for an empty input", () => {
    expect(detectCtrUnderperformers("project-1", [])).toHaveLength(0);
  });
});
