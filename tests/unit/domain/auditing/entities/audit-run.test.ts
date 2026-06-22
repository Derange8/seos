import { describe, expect, it } from "vitest";
import { AuditRun } from "@/domain/auditing/entities/audit-run";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { AuditRunCompleted } from "@/domain/auditing/events/audit-run-completed";

function issue(severity: "INFO" | "WARNING" | "CRITICAL", auditRunId: string): AuditIssue {
  return AuditIssue.create(auditRunId, "page-1", {
    ruleId: "rule",
    category: "technical",
    severity,
    message: "msg",
  });
}

describe("AuditRun", () => {
  it("starts with no issues, unfinished", () => {
    const run = AuditRun.create("project-1", "job-1");
    expect(run.issues).toHaveLength(0);
    expect(run.isFinished).toBe(false);
    expect(run.overallScore).toBeNull();
  });

  it("scores 100 when finished with zero issues", () => {
    const run = AuditRun.create("project-1", "job-1");
    const result = run.finish(10);

    expect(result.ok).toBe(true);
    expect(run.overallScore).toBe(100);
    expect(run.isFinished).toBe(true);
    expect(run.finishedAt).toBeInstanceOf(Date);
  });

  it("deducts a normalized penalty per issue, weighted by severity", () => {
    const run = AuditRun.create("project-1", "job-1");
    run.addIssue(issue("CRITICAL", run.id)); // -10
    run.addIssue(issue("WARNING", run.id)); // -4
    run.addIssue(issue("INFO", run.id)); // -1

    run.finish(5); // total penalty 15, normalized by 5 pages = 3

    expect(run.overallScore).toBe(97);
  });

  it("never scores below 0", () => {
    const run = AuditRun.create("project-1", "job-1");
    for (let i = 0; i < 20; i++) run.addIssue(issue("CRITICAL", run.id));

    run.finish(1); // huge penalty relative to a single page

    expect(run.overallScore).toBe(0);
  });

  it("emits AuditRunCompleted on finish", () => {
    const run = AuditRun.create("project-1", "job-1");
    run.finish(10);

    const events = run.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(AuditRunCompleted);
  });

  it("refuses to finish an already-finished run", () => {
    const run = AuditRun.create("project-1", "job-1");
    run.finish(10);

    const result = run.finish(10);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_AUDIT_RUN_STATE");
  });

  it("reconstitute() rehydrates from persisted props", () => {
    const startedAt = new Date("2026-01-01T00:00:00Z");
    const run = AuditRun.reconstitute({
      id: "run-1",
      projectId: "project-1",
      crawlJobId: "job-1",
      issues: [],
      overallScore: 87.5,
      startedAt,
      finishedAt: null,
    });

    expect(run.id).toBe("run-1");
    expect(run.overallScore).toBe(87.5);
    expect(run.startedAt).toBe(startedAt);
  });
});
