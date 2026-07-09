import { describe, expect, it } from "vitest";
import { formatAuditReport } from "@/lib/format-audit-report";
import type { AuditRunDto } from "@/application/auditing/dto";
import type { FixCandidateDto } from "@/application/fixes/dto";

function baseAuditRun(overrides: Partial<AuditRunDto> = {}): AuditRunDto {
  return {
    id: "run-1",
    projectId: "project-1",
    crawlJobId: "job-1",
    overallScore: 87,
    isFinished: true,
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:01.000Z",
    issues: [],
    ...overrides,
  };
}

function fixFor(auditIssueId: string, overrides: Partial<FixCandidateDto> = {}): FixCandidateDto {
  return {
    id: "fix-1",
    auditIssueId,
    pageId: "page-1",
    type: "TITLE",
    content: "A Better Title",
    source: "rule_based",
    status: "DRAFT",
    previousValue: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("formatAuditReport", () => {
  it("includes the domain, score, and issue count in the header", () => {
    const report = formatAuditReport("example.com", baseAuditRun({ overallScore: 92 }), []);
    expect(report).toContain("example.com");
    expect(report).toContain("92/100");
    expect(report).toContain("0 issues");
  });

  it("numbers each issue and includes its severity, rule, and message", () => {
    const auditRun = baseAuditRun({
      issues: [
        {
          id: "issue-1",
          pageId: "page-1",
          pageUrl: null,
          routeTemplate: null,
          ruleId: "missing-title",
          category: "technical",
          severity: "CRITICAL",
          message: "https://example.com/ is missing a title",
          recommendation: null,
          priority: { tier: "MANUAL_REVIEW", impactScore: 10, hasReadyFix: false, estimatedFixTime: "ONE_MINUTE" },
          trafficImpact: { tier: "P1", pageImpressions: 0, pageClicks: 0, hasTrafficData: false },
        },
      ],
    });

    const report = formatAuditReport("example.com", auditRun, []);

    expect(report).toContain("1. [CRITICAL] missing-title — https://example.com/ is missing a title");
  });

  it("includes the recommendation and matching fix candidate's content when present", () => {
    const auditRun = baseAuditRun({
      issues: [
        {
          id: "issue-1",
          pageId: "page-1",
          pageUrl: null,
          routeTemplate: null,
          ruleId: "missing-title",
          category: "technical",
          severity: "CRITICAL",
          message: "missing title",
          recommendation: "Add a descriptive title.",
          priority: { tier: "QUICK_WIN", impactScore: 10, hasReadyFix: true, estimatedFixTime: "ONE_MINUTE" },
          trafficImpact: { tier: "P1", pageImpressions: 0, pageClicks: 0, hasTrafficData: false },
        },
      ],
    });

    const report = formatAuditReport("example.com", auditRun, [fixFor("issue-1", { content: "Acme Tools — Hand Tools for Makers" })]);

    expect(report).toContain("Recommendation: Add a descriptive title.");
    expect(report).toContain("Suggested fix (TITLE): Acme Tools — Hand Tools for Makers");
  });

  it("omits recommendation/fix lines when neither exists", () => {
    const auditRun = baseAuditRun({
      issues: [
        {
          id: "issue-1",
          pageId: "page-1",
          pageUrl: null,
          routeTemplate: null,
          ruleId: "thin-content",
          category: "content",
          severity: "WARNING",
          message: "thin content",
          recommendation: null,
          priority: { tier: "LOW_PRIORITY", impactScore: 4, hasReadyFix: false, estimatedFixTime: "ONE_MINUTE" },
          trafficImpact: { tier: "P4", pageImpressions: 0, pageClicks: 0, hasTrafficData: false },
        },
      ],
    });

    const report = formatAuditReport("example.com", auditRun, []);

    expect(report).not.toContain("Recommendation:");
    expect(report).not.toContain("Suggested fix");
  });

  it("collapses issues sharing a ruleId and routeTemplate into one summary entry", () => {
    const auditRun = baseAuditRun({
      issues: [
        {
          id: "issue-1",
          pageId: "page-1",
          pageUrl: "https://example.com/post/1",
          routeTemplate: "/post/[id]",
          ruleId: "thin-content",
          category: "content",
          severity: "WARNING",
          message: "thin content",
          recommendation: null,
          priority: { tier: "LOW_PRIORITY", impactScore: 4, hasReadyFix: false, estimatedFixTime: "ONE_MINUTE" },
          trafficImpact: { tier: "P4", pageImpressions: 0, pageClicks: 0, hasTrafficData: false },
        },
        {
          id: "issue-2",
          pageId: "page-2",
          pageUrl: "https://example.com/post/2",
          routeTemplate: "/post/[id]",
          ruleId: "thin-content",
          category: "content",
          severity: "WARNING",
          message: "thin content",
          recommendation: null,
          priority: { tier: "LOW_PRIORITY", impactScore: 4, hasReadyFix: false, estimatedFixTime: "ONE_MINUTE" },
          trafficImpact: { tier: "P4", pageImpressions: 0, pageClicks: 0, hasTrafficData: false },
        },
      ],
    });

    const report = formatAuditReport("example.com", auditRun, []);

    expect(report).toContain("1. [WARNING] thin-content — /post/[id] (2 pages, e.g. https://example.com/post/1, https://example.com/post/2)");
    expect(report).not.toContain("2. [WARNING]");
  });

  it("falls back to N/A when there is no overall score yet", () => {
    const report = formatAuditReport("example.com", baseAuditRun({ overallScore: null }), []);
    expect(report).toContain("N/A/100");
  });
});
