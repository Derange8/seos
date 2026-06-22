import { describe, expect, it } from "vitest";
import { calculateSeoScores } from "@/domain/scoring/services/seo-score-calculator";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";

function issue(pageId: string, category: "technical" | "content", severity: "CRITICAL" | "WARNING" | "INFO"): AuditIssue {
  return AuditIssue.create("run-1", pageId, { ruleId: "rule", category, severity, message: "msg" });
}

describe("calculateSeoScores", () => {
  it("produces a site-level row for every category, even with no issues", () => {
    const scores = calculateSeoScores("run-1", [], ["page-1", "page-2"]);

    const siteLevel = scores.filter((s) => s.isSiteLevel);
    expect(siteLevel).toHaveLength(4);
    expect(siteLevel.every((s) => s.score === 100)).toBe(true);
  });

  it("produces one row per (page, category) for every page", () => {
    const scores = calculateSeoScores("run-1", [], ["page-1", "page-2"]);
    const perPage = scores.filter((s) => !s.isSiteLevel);
    expect(perPage).toHaveLength(8); // 2 pages * 4 categories
  });

  it("normalizes the site-level score by page count, matching AuditRun.overallScore's formula", () => {
    // 1 CRITICAL (penalty 10) on a "technical" issue, across 2 pages -> 100 - 10/2 = 95
    const scores = calculateSeoScores("run-1", [issue("page-1", "technical", "CRITICAL")], ["page-1", "page-2"]);

    const technical = scores.find((s) => s.isSiteLevel && s.category === "technical");
    expect(technical?.score).toBe(95);
  });

  it("scopes a page-level score to only that page's issues, unnormalized by page count", () => {
    const scores = calculateSeoScores(
      "run-1",
      [issue("page-1", "technical", "CRITICAL"), issue("page-2", "content", "WARNING")],
      ["page-1", "page-2"]
    );

    const page1Technical = scores.find((s) => s.pageId === "page-1" && s.category === "technical");
    const page1Content = scores.find((s) => s.pageId === "page-1" && s.category === "content");
    const page2Content = scores.find((s) => s.pageId === "page-2" && s.category === "content");

    expect(page1Technical?.score).toBe(90); // 100 - 10
    expect(page1Content?.score).toBe(100); // no content issues on page-1
    expect(page2Content?.score).toBe(96); // 100 - 4
  });

  it("clamps a category score at 0 rather than going negative", () => {
    const issues = Array.from({ length: 20 }, () => issue("page-1", "technical", "CRITICAL"));
    const scores = calculateSeoScores("run-1", issues, ["page-1"]);

    const page1Technical = scores.find((s) => s.pageId === "page-1" && s.category === "technical");
    expect(page1Technical?.score).toBe(0);
  });

  it("returns only site-level rows (all scoring 100) when there are no pages", () => {
    const scores = calculateSeoScores("run-1", [], []);
    expect(scores).toHaveLength(4);
    expect(scores.every((s) => s.isSiteLevel && s.score === 100)).toBe(true);
  });
});
