import { describe, expect, it } from "vitest";
import { ComputeAuditDeltaUseCase } from "@/application/delta-audit/use-cases/compute-audit-delta-use-case";
import { AuditRun } from "@/domain/auditing/entities/audit-run";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";
import { FakeAuditRunRepository } from "../auditing/fakes";
import { FakePageRepository } from "../crawling/fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("ComputeAuditDeltaUseCase", () => {
  it("returns null when fewer than two finished audit runs exist for the project", async () => {
    const auditRunRepository = new FakeAuditRunRepository();
    const auditRun = AuditRun.create("project-1", "job-1");
    auditRun.finish(1);
    await auditRunRepository.save(auditRun);

    const useCase = new ComputeAuditDeltaUseCase({
      auditRunRepository,
      pageRepository: new FakePageRepository(),
    });

    const delta = await useCase.execute("project-1");

    expect(delta).toBeNull();
  });

  it("computes a delta between the two most recent finished runs, resolving page urls across crawl jobs", async () => {
    const auditRunRepository = new FakeAuditRunRepository();
    const pageRepository = new FakePageRepository();

    const pageA = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    await pageRepository.save("project-1", pageA);
    const issueA = AuditIssue.create("run-a", pageA.id, {
      ruleId: "missing-title",
      category: "technical",
      severity: "CRITICAL",
      message: "no title",
    });
    // Explicit, clearly-ordered timestamps rather than two back-to-back
    // `new Date()` calls — those can land in the same millisecond and
    // make "which run is most recent" nondeterministic.
    const auditRunA = AuditRun.reconstitute({
      id: "run-a",
      projectId: "project-1",
      crawlJobId: "job-1",
      issues: [issueA],
      overallScore: 90,
      startedAt: new Date("2026-01-01T00:00:00Z"),
      finishedAt: new Date("2026-01-01T00:01:00Z"),
    });
    await auditRunRepository.save(auditRunA);

    const pageB = Page.create("job-2", url("https://example.com/"), { statusCode: 200 });
    await pageRepository.save("project-1", pageB);
    const issueB = AuditIssue.create("run-b", pageB.id, {
      ruleId: "missing-h1",
      category: "content",
      severity: "WARNING",
      message: "no h1",
    });
    const auditRunB = AuditRun.reconstitute({
      id: "run-b",
      projectId: "project-1",
      crawlJobId: "job-2",
      issues: [issueB],
      overallScore: 96,
      startedAt: new Date("2026-01-02T00:00:00Z"),
      finishedAt: new Date("2026-01-02T00:01:00Z"),
    });
    await auditRunRepository.save(auditRunB);

    const useCase = new ComputeAuditDeltaUseCase({ auditRunRepository, pageRepository });
    const delta = await useCase.execute("project-1");

    expect(delta).not.toBeNull();
    expect(delta?.previousRunId).toBe(auditRunA.id);
    expect(delta?.currentRunId).toBe(auditRunB.id);
    expect(delta?.resolvedCount).toBe(1);
    expect(delta?.newCount).toBe(1);
  });
});
