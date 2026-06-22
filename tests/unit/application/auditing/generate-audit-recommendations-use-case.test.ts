import { describe, expect, it } from "vitest";
import { GenerateAuditRecommendationsUseCase } from "@/application/auditing/use-cases/generate-audit-recommendations-use-case";
import { AuditRun } from "@/domain/auditing/entities/audit-run";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { FakeAuditRunRepository } from "./fakes";
import { FakeLLMProvider } from "./llm-fakes";

describe("GenerateAuditRecommendationsUseCase", () => {
  it("sends only unrecommended issues to the LLM and persists what comes back", async () => {
    const auditRunRepository = new FakeAuditRunRepository();
    const auditRun = AuditRun.create("project-1", "job-1");
    const issue = AuditIssue.create(auditRun.id, "page-1", {
      ruleId: "missing-title",
      category: "technical",
      severity: "CRITICAL",
      message: "no title",
    });
    auditRun.addIssue(issue);
    auditRun.finish(1);
    await auditRunRepository.save(auditRun);

    const llm = new FakeLLMProvider();
    llm.responses.set(issue.id, "Add a descriptive <title> tag.");

    const useCase = new GenerateAuditRecommendationsUseCase({ auditRunRepository, llm });
    await useCase.execute(auditRun.id);

    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0]).toHaveLength(1);
    const saved = await auditRunRepository.findById(auditRun.id);
    expect(saved?.issues[0]?.recommendation).toBe("Add a descriptive <title> tag.");
  });

  it("does not call the LLM or save when every issue already has a recommendation", async () => {
    const auditRunRepository = new FakeAuditRunRepository();
    const auditRun = AuditRun.create("project-1", "job-1");
    const issue = AuditIssue.create(auditRun.id, "page-1", {
      ruleId: "missing-title",
      category: "technical",
      severity: "CRITICAL",
      message: "no title",
    });
    issue.setRecommendation("Already enriched.");
    auditRun.addIssue(issue);
    auditRun.finish(1);
    await auditRunRepository.save(auditRun);

    const llm = new FakeLLMProvider();
    const useCase = new GenerateAuditRecommendationsUseCase({ auditRunRepository, llm });
    await useCase.execute(auditRun.id);

    expect(llm.calls).toHaveLength(0);
  });

  it("leaves an issue unrecommended if the provider doesn't return one for it", async () => {
    const auditRunRepository = new FakeAuditRunRepository();
    const auditRun = AuditRun.create("project-1", "job-1");
    const issue = AuditIssue.create(auditRun.id, "page-1", {
      ruleId: "missing-title",
      category: "technical",
      severity: "CRITICAL",
      message: "no title",
    });
    auditRun.addIssue(issue);
    auditRun.finish(1);
    await auditRunRepository.save(auditRun);

    const useCase = new GenerateAuditRecommendationsUseCase({ auditRunRepository, llm: new FakeLLMProvider() });
    await useCase.execute(auditRun.id);

    const saved = await auditRunRepository.findById(auditRun.id);
    expect(saved?.issues[0]?.recommendation).toBeNull();
  });

  it("throws when the audit run does not exist", async () => {
    const useCase = new GenerateAuditRecommendationsUseCase({
      auditRunRepository: new FakeAuditRunRepository(),
      llm: new FakeLLMProvider(),
    });

    await expect(useCase.execute("missing-run")).rejects.toThrow();
  });
});
