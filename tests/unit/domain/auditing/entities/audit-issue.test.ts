import { describe, expect, it } from "vitest";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";

describe("AuditIssue", () => {
  it("creates an issue from a finding with no recommendation yet", () => {
    const issue = AuditIssue.create("run-1", "page-1", {
      ruleId: "missing-title",
      category: "technical",
      severity: "CRITICAL",
      message: "no title",
    });

    expect(issue.auditRunId).toBe("run-1");
    expect(issue.pageId).toBe("page-1");
    expect(issue.ruleId).toBe("missing-title");
    expect(issue.category).toBe("technical");
    expect(issue.severity).toBe("CRITICAL");
    expect(issue.message).toBe("no title");
    expect(issue.recommendation).toBeNull();
  });

  it("reconstitute() rehydrates from persisted props", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const issue = AuditIssue.reconstitute({
      id: "issue-1",
      auditRunId: "run-1",
      pageId: "page-1",
      ruleId: "missing-title",
      category: "technical",
      severity: "CRITICAL",
      message: "no title",
      recommendation: "Add a descriptive <title> tag.",
      createdAt,
    });

    expect(issue.id).toBe("issue-1");
    expect(issue.recommendation).toBe("Add a descriptive <title> tag.");
    expect(issue.createdAt).toBe(createdAt);
  });

  it("setRecommendation() fills in a previously-null recommendation", () => {
    const issue = AuditIssue.create("run-1", "page-1", {
      ruleId: "missing-title",
      category: "technical",
      severity: "CRITICAL",
      message: "no title",
    });

    issue.setRecommendation("Add a descriptive <title> tag.");

    expect(issue.recommendation).toBe("Add a descriptive <title> tag.");
  });
});
