import { describe, expect, it } from "vitest";
import { GenerateFixCandidatesUseCase } from "@/application/fixes/use-cases/generate-fix-candidates-use-case";
import { AuditRun } from "@/domain/auditing/entities/audit-run";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";
import { FakeFixCandidateRepository } from "./fakes";
import { FakeAuditRunRepository } from "../auditing/fakes";
import { FakePageRepository } from "../crawling/fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("GenerateFixCandidatesUseCase", () => {
  it("generates and persists fix candidates for generatable issues using the audit run's pages", async () => {
    const auditRunRepository = new FakeAuditRunRepository();
    const pageRepository = new FakePageRepository();

    const page = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    await pageRepository.save("project-1", page);

    const auditRun = AuditRun.create("project-1", "job-1");
    auditRun.addIssue(
      AuditIssue.create(auditRun.id, page.id, {
        ruleId: "missing-title",
        category: "technical",
        severity: "CRITICAL",
        message: "no title",
      })
    );
    auditRun.addIssue(
      AuditIssue.create(auditRun.id, page.id, {
        ruleId: "thin-content",
        category: "content",
        severity: "WARNING",
        message: "thin content",
      })
    );
    auditRun.finish(1);
    await auditRunRepository.save(auditRun);

    const fixCandidateRepository = new FakeFixCandidateRepository();
    const useCase = new GenerateFixCandidatesUseCase({
      auditRunRepository,
      pageRepository,
      fixCandidateRepository,
    });

    const candidates = await useCase.execute(auditRun.id);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.type).toBe("TITLE");
    expect(fixCandidateRepository.saved).toHaveLength(1);
  });

  it("throws when the audit run does not exist", async () => {
    const useCase = new GenerateFixCandidatesUseCase({
      auditRunRepository: new FakeAuditRunRepository(),
      pageRepository: new FakePageRepository(),
      fixCandidateRepository: new FakeFixCandidateRepository(),
    });

    await expect(useCase.execute("missing-run")).rejects.toThrow();
  });
});
