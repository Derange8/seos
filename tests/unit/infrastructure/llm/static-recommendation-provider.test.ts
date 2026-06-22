import { describe, expect, it } from "vitest";
import { StaticRecommendationProvider } from "@/infrastructure/llm/static-recommendation-provider";

describe("StaticRecommendationProvider", () => {
  it("returns a known recommendation for a recognized rule id", async () => {
    const provider = new StaticRecommendationProvider();

    const result = await provider.generateRecommendations([
      { issueId: "issue-1", ruleId: "missing-title", category: "technical", severity: "CRITICAL", message: "no title" },
    ]);

    expect(result.get("issue-1")).toContain("<title>");
  });

  it("falls back to a generic recommendation for an unrecognized rule id", async () => {
    const provider = new StaticRecommendationProvider();

    const result = await provider.generateRecommendations([
      { issueId: "issue-1", ruleId: "some-future-rule", category: "technical", severity: "INFO", message: "something odd" },
    ]);

    expect(result.get("issue-1")).toBe("Review and resolve: something odd");
  });

  it("returns one recommendation per issue, keyed by issueId", async () => {
    const provider = new StaticRecommendationProvider();

    const result = await provider.generateRecommendations([
      { issueId: "issue-1", ruleId: "missing-title", category: "technical", severity: "CRITICAL", message: "a" },
      { issueId: "issue-2", ruleId: "missing-h1", category: "content", severity: "WARNING", message: "b" },
    ]);

    expect(result.size).toBe(2);
    expect(result.get("issue-1")).not.toBe(result.get("issue-2"));
  });
});
