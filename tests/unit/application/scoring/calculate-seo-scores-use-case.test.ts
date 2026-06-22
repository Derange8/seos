import { describe, expect, it } from "vitest";
import { CalculateSeoScoresUseCase } from "@/application/scoring/use-cases/calculate-seo-scores-use-case";
import { AuditRun } from "@/domain/auditing/entities/audit-run";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";
import { FakeSeoScoreRepository } from "./fakes";
import { FakeAuditRunRepository } from "../auditing/fakes";
import { FakePageRepository } from "../crawling/fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("CalculateSeoScoresUseCase", () => {
  it("calculates and persists scores using the audit run's issues and the crawl job's pages", async () => {
    const auditRunRepository = new FakeAuditRunRepository();
    const auditRun = AuditRun.create("project-1", "job-1");
    auditRun.addIssue(
      AuditIssue.create(auditRun.id, "page-1", {
        ruleId: "missing-title",
        category: "technical",
        severity: "CRITICAL",
        message: "no title",
      })
    );
    auditRun.finish(1);
    await auditRunRepository.save(auditRun);

    const pageRepository = new FakePageRepository();
    const page = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    await pageRepository.save("project-1", page);

    const seoScoreRepository = new FakeSeoScoreRepository();
    const useCase = new CalculateSeoScoresUseCase({ auditRunRepository, pageRepository, seoScoreRepository });

    const scores = await useCase.execute(auditRun.id);

    expect(scores.length).toBeGreaterThan(0);
    expect(seoScoreRepository.saved).toHaveLength(scores.length);
    const siteLevel = scores.filter((s) => s.isSiteLevel);
    expect(siteLevel).toHaveLength(4);
  });

  it("throws when the audit run does not exist", async () => {
    const useCase = new CalculateSeoScoresUseCase({
      auditRunRepository: new FakeAuditRunRepository(),
      pageRepository: new FakePageRepository(),
      seoScoreRepository: new FakeSeoScoreRepository(),
    });

    await expect(useCase.execute("missing-run")).rejects.toThrow();
  });
});
