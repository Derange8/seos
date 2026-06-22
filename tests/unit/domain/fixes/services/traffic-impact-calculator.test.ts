import { describe, expect, it } from "vitest";
import { calculateTrafficImpact } from "@/domain/fixes/services/traffic-impact-calculator";
import { AuditIssue, type AuditSeverity } from "@/domain/auditing/entities/audit-issue";
import { PagePerformance } from "@/domain/tracking/entities/page-performance";

function issue(pageId: string, severity: AuditSeverity, ruleId = "rule"): AuditIssue {
  return AuditIssue.create("run-1", pageId, { ruleId, category: "technical", severity, message: "msg" });
}

function performance(pageUrl: string, impressions: number, clicks = 0): PagePerformance {
  return PagePerformance.create("project-1", pageUrl, clicks, impressions, 0, 10);
}

describe("calculateTrafficImpact", () => {
  it("ranks a high-traffic page's issue above a no-traffic page's issue of the same severity", () => {
    const highTraffic = issue("page-high", "WARNING", "a");
    const noTraffic = issue("page-low", "WARNING", "b");
    const pageUrls = new Map([
      ["page-high", "https://example.com/popular"],
      ["page-low", "https://example.com/quiet"],
    ]);

    const result = calculateTrafficImpact(
      [noTraffic, highTraffic],
      pageUrls,
      [performance("https://example.com/popular", 1000)]
    );

    const byId = new Map(result.map((r) => [r.issueId, r]));
    expect(byId.get(highTraffic.id)?.tier).toBe("P1");
    expect(byId.get(noTraffic.id)?.tier).toBe("P3");
  });

  it("marks hasTrafficData false when no PagePerformance row exists for the issue's page", () => {
    const orphan = issue("page-unknown", "INFO");
    const [result] = calculateTrafficImpact([orphan], new Map([["page-unknown", "https://example.com/x"]]), []);

    expect(result.hasTrafficData).toBe(false);
    expect(result.pageImpressions).toBe(0);
  });

  it("still ranks by severity alone when no traffic data exists for any page", () => {
    const critical = issue("page-1", "CRITICAL", "a");
    const info = issue("page-2", "INFO", "b");

    const result = calculateTrafficImpact(
      [info, critical],
      new Map([
        ["page-1", "https://example.com/a"],
        ["page-2", "https://example.com/b"],
      ]),
      []
    );

    const byId = new Map(result.map((r) => [r.issueId, r]));
    expect(byId.get(critical.id)?.tier).toBe("P1");
    expect(byId.get(info.id)?.tier).toBe("P3");
  });

  it("returns an empty array for no issues", () => {
    expect(calculateTrafficImpact([], new Map(), [])).toEqual([]);
  });
});
