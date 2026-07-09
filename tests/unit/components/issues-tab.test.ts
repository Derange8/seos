import { describe, expect, it } from "vitest";
import { countBySeverity, filterIssueGroups, type IssueGroup } from "@/components/project-dashboard/issues-tab";
import type { AuditIssueDto } from "@/application/auditing/dto";

function issue(overrides: Partial<AuditIssueDto> = {}): AuditIssueDto {
  return {
    id: "issue-1",
    pageId: "page-1",
    pageUrl: "https://example.com/",
    routeTemplate: null,
    ruleId: "missing-title",
    category: "technical",
    severity: "WARNING",
    message: "no title",
    recommendation: null,
    priority: { tier: "QUICK_WIN", impactScore: 10, hasReadyFix: true, estimatedFixTime: "ONE_MINUTE" },
    trafficImpact: { tier: "P1", pageImpressions: 0, pageClicks: 0, hasTrafficData: false },
    ...overrides,
  };
}

describe("countBySeverity", () => {
  it("counts issues per severity, defaulting missing severities to zero", () => {
    const issues = [
      issue({ id: "1", severity: "CRITICAL" }),
      issue({ id: "2", severity: "WARNING" }),
      issue({ id: "3", severity: "WARNING" }),
    ];
    expect(countBySeverity(issues)).toEqual({ CRITICAL: 1, WARNING: 2, INFO: 0 });
  });

  it("returns all zeros for an empty list", () => {
    expect(countBySeverity([])).toEqual({ CRITICAL: 0, WARNING: 0, INFO: 0 });
  });
});

describe("filterIssueGroups", () => {
  it("returns every group unchanged when the filter is ALL", () => {
    const groups: IssueGroup[] = [
      { ruleId: "missing-title", issues: [issue({ severity: "CRITICAL" })], templateGroups: [], ungroupedIssues: [issue()] },
    ];
    expect(filterIssueGroups(groups, "ALL")).toBe(groups);
  });

  it("drops issues that don't match the selected severity", () => {
    const critical = issue({ id: "1", severity: "CRITICAL" });
    const warning = issue({ id: "2", severity: "WARNING" });
    const groups: IssueGroup[] = [
      { ruleId: "missing-title", issues: [critical, warning], templateGroups: [], ungroupedIssues: [critical, warning] },
    ];

    const filtered = filterIssueGroups(groups, "CRITICAL");

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.issues).toEqual([critical]);
    expect(filtered[0]?.ungroupedIssues).toEqual([critical]);
  });

  it("drops a group entirely when none of its issues match the filter", () => {
    const groups: IssueGroup[] = [
      { ruleId: "missing-title", issues: [issue({ severity: "INFO" })], templateGroups: [], ungroupedIssues: [issue({ severity: "INFO" })] },
    ];

    expect(filterIssueGroups(groups, "CRITICAL")).toEqual([]);
  });

  it("re-derives template groups from the filtered issues, dropping templates left with only one match", () => {
    const post1 = issue({ id: "1", severity: "WARNING", routeTemplate: "/post/[id]" });
    const post2 = issue({ id: "2", severity: "WARNING", routeTemplate: "/post/[id]" });
    const post3 = issue({ id: "3", severity: "CRITICAL", routeTemplate: "/post/[id]" });
    const groups: IssueGroup[] = [
      {
        ruleId: "thin-content",
        issues: [post1, post2, post3],
        templateGroups: [{ routeTemplate: "/post/[id]", issues: [post1, post2, post3] }],
        ungroupedIssues: [],
      },
    ];

    // Filtering to CRITICAL leaves only post3 in the template — a single
    // match no longer forms a "template" group, so it should fall back to
    // an ungrouped row instead of a disclosure with one item inside it.
    const filtered = filterIssueGroups(groups, "CRITICAL");

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.templateGroups).toEqual([]);
    expect(filtered[0]?.ungroupedIssues).toEqual([post3]);
  });
});
