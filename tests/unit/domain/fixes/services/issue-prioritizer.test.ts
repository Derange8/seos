import { describe, expect, it } from "vitest";
import { prioritizeIssues } from "@/domain/fixes/services/issue-prioritizer";
import { AuditIssue, type AuditSeverity } from "@/domain/auditing/entities/audit-issue";
import { FixCandidate } from "@/domain/fixes/entities/fix-candidate";

function issue(severity: AuditSeverity, ruleId = "rule"): AuditIssue {
  return AuditIssue.create("run-1", "page-1", {
    ruleId,
    category: "technical",
    severity,
    message: "msg",
  });
}

function fixFor(issueId: string): FixCandidate {
  return FixCandidate.createRuleBased(issueId, "page-1", "TITLE", "content");
}

describe("prioritizeIssues", () => {
  it("classifies a high-impact issue with a ready fix as a quick win", () => {
    const critical = issue("CRITICAL");
    const [priority] = prioritizeIssues([critical], [fixFor(critical.id)]);
    expect(priority?.tier).toBe("QUICK_WIN");
    expect(priority?.hasReadyFix).toBe(true);
  });

  it("classifies a high-impact issue with no fix as needing manual review", () => {
    const critical = issue("CRITICAL");
    const [priority] = prioritizeIssues([critical], []);
    expect(priority?.tier).toBe("MANUAL_REVIEW");
    expect(priority?.hasReadyFix).toBe(false);
  });

  it("classifies a low-impact issue with a ready fix as a fill-in", () => {
    const info = issue("INFO");
    const [priority] = prioritizeIssues([info], [fixFor(info.id)]);
    expect(priority?.tier).toBe("FILL_IN");
  });

  it("classifies a low-impact issue with no fix as low priority", () => {
    const info = issue("INFO");
    const [priority] = prioritizeIssues([info], []);
    expect(priority?.tier).toBe("LOW_PRIORITY");
  });

  it("sorts quick wins first, then manual review, then fill-ins, then low priority", () => {
    const quickWin = issue("CRITICAL", "a");
    const manualReview = issue("WARNING", "b");
    const fillIn = issue("INFO", "c");
    const lowPriority = issue("INFO", "d");

    const result = prioritizeIssues(
      [lowPriority, fillIn, manualReview, quickWin],
      [fixFor(quickWin.id), fixFor(fillIn.id)]
    );

    expect(result.map((p) => p.issueId)).toEqual([
      quickWin.id,
      manualReview.id,
      fillIn.id,
      lowPriority.id,
    ]);
  });

  it("breaks ties within a tier by impact score, critical before warning", () => {
    const criticalQuickWin = issue("CRITICAL", "a");
    const warningQuickWin = issue("WARNING", "b");

    const result = prioritizeIssues(
      [warningQuickWin, criticalQuickWin],
      [fixFor(warningQuickWin.id), fixFor(criticalQuickWin.id)]
    );

    expect(result.map((p) => p.issueId)).toEqual([criticalQuickWin.id, warningQuickWin.id]);
  });
});
