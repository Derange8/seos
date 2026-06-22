import { describe, expect, it } from "vitest";
import { computeAuditDelta } from "@/domain/delta-audit/services/delta-audit-calculator";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";

const PAGE_URL = "https://example.com/";

function issue(runId: string, pageId: string, ruleId: string, severity: "INFO" | "WARNING" | "CRITICAL" = "WARNING"): AuditIssue {
  return AuditIssue.create(runId, pageId, { ruleId, category: "content", severity, message: "msg" });
}

describe("computeAuditDelta", () => {
  it("marks an issue present only in the previous run as resolved", () => {
    const resolvedIssue = issue("run-1", "page-1", "missing-title");

    const delta = computeAuditDelta(
      { runId: "run-1", overallScore: 80, issues: [resolvedIssue] },
      { runId: "run-2", overallScore: 100, issues: [] },
      new Map([["page-1", PAGE_URL]])
    );

    expect(delta.resolvedCount).toBe(1);
    expect(delta.newCount).toBe(0);
    expect(delta.persistingCount).toBe(0);
    expect(delta.issues[0]?.changeType).toBe("RESOLVED");
    expect(delta.scoreDelta).toBe(20);
  });

  it("marks an issue present only in the current run as new", () => {
    const newIssue = issue("run-2", "page-2", "missing-h1");

    const delta = computeAuditDelta(
      { runId: "run-1", overallScore: 100, issues: [] },
      { runId: "run-2", overallScore: 96, issues: [newIssue] },
      new Map([["page-2", PAGE_URL]])
    );

    expect(delta.newCount).toBe(1);
    expect(delta.resolvedCount).toBe(0);
    expect(delta.issues[0]?.changeType).toBe("NEW");
    expect(delta.scoreDelta).toBe(-4);
  });

  it("matches the same issue across runs by (pageUrl, ruleId), not pageId", () => {
    // Different pageIds (fresh per crawl) but the same URL+rule should
    // still be recognized as the same persisting issue.
    const before = issue("run-1", "page-1", "missing-canonical", "INFO");
    const after = issue("run-2", "page-1-v2", "missing-canonical", "INFO");

    const delta = computeAuditDelta(
      { runId: "run-1", overallScore: 99, issues: [before] },
      { runId: "run-2", overallScore: 99, issues: [after] },
      new Map([
        ["page-1", PAGE_URL],
        ["page-1-v2", PAGE_URL],
      ])
    );

    expect(delta.persistingCount).toBe(1);
    expect(delta.resolvedCount).toBe(0);
    expect(delta.newCount).toBe(0);
  });

  it("treats the same rule on different pages as distinct issues", () => {
    const onPageA = issue("run-1", "page-a", "missing-title");
    const onPageB = issue("run-2", "page-b", "missing-title");

    const delta = computeAuditDelta(
      { runId: "run-1", overallScore: 90, issues: [onPageA] },
      { runId: "run-2", overallScore: 90, issues: [onPageB] },
      new Map([
        ["page-a", "https://example.com/a"],
        ["page-b", "https://example.com/b"],
      ])
    );

    expect(delta.resolvedCount).toBe(1);
    expect(delta.newCount).toBe(1);
    expect(delta.persistingCount).toBe(0);
  });

  it("skips issues whose page url cannot be resolved rather than guessing", () => {
    const orphanIssue = issue("run-1", "unknown-page", "missing-title");

    const delta = computeAuditDelta(
      { runId: "run-1", overallScore: 90, issues: [orphanIssue] },
      { runId: "run-2", overallScore: 90, issues: [] },
      new Map()
    );

    expect(delta.issues).toHaveLength(0);
    expect(delta.resolvedCount).toBe(0);
  });

  it("returns a null scoreDelta when either score is unavailable", () => {
    const delta = computeAuditDelta(
      { runId: "run-1", overallScore: null, issues: [] },
      { runId: "run-2", overallScore: 90, issues: [] },
      new Map()
    );

    expect(delta.scoreDelta).toBeNull();
  });
});
