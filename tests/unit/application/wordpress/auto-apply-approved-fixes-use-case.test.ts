import { describe, expect, it } from "vitest";
import { AutoApplyApprovedFixesUseCase } from "@/application/wordpress/use-cases/auto-apply-approved-fixes-use-case";
import { AuditRun } from "@/domain/auditing/entities/audit-run";
import { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";
import { Page } from "@/domain/crawling/entities/page";
import { Project } from "@/domain/projects/entities/project";
import { DomainName } from "@/domain/projects/value-objects/domain-name";
import { Url } from "@/domain/crawling/value-objects/url";
import { WordPressConnection } from "@/domain/wordpress/entities/wordpress-connection";
import { ok } from "@/shared/result";
import { FakeFixCandidateRepository } from "../fixes/fakes";
import { FakeCrawlJobRepository, FakePageRepository, SilentLogger } from "../crawling/fakes";
import { FakeAuditRunRepository } from "../auditing/fakes";
import { FakeProjectRepository } from "../projects/fakes";
import { FakeWordPressClient, FakeWordPressConnectionRepository } from "./fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok url");
  return result.value;
}

function domain(input: string): DomainName {
  const result = DomainName.create(input);
  if (!result.ok) throw new Error("expected ok domain");
  return result.value;
}

function buildDeps() {
  const fixCandidateRepository = new FakeFixCandidateRepository();
  const pageRepository = new FakePageRepository();
  const crawlJobRepository = new FakeCrawlJobRepository();
  const wordPressConnectionRepository = new FakeWordPressConnectionRepository();
  const wordPressClient = new FakeWordPressClient();
  const auditRunRepository = new FakeAuditRunRepository();
  const projectRepository = new FakeProjectRepository();

  const project = Project.create("My Site", domain("example.com"));
  projectRepository.seed(project);

  const configResult = CrawlConfig.create();
  if (!configResult.ok) throw new Error("expected ok config");
  const crawlJob = CrawlJob.create(project.id, configResult.value);
  crawlJobRepository.seed(crawlJob);

  const auditRun = AuditRun.create(project.id, crawlJob.id);
  auditRunRepository.save(auditRun);

  return {
    fixCandidateRepository,
    pageRepository,
    crawlJobRepository,
    wordPressConnectionRepository,
    wordPressClient,
    auditRunRepository,
    projectRepository,
    project,
    crawlJob,
    auditRun,
  };
}

describe("AutoApplyApprovedFixesUseCase", () => {
  it("does nothing when Otomatik Pilot is off", async () => {
    const deps = buildDeps();
    const page = Page.create(deps.crawlJob.id, url("https://example.com/about"));
    await deps.pageRepository.save(deps.project.id, page);
    const fixCandidate = FixCandidate.createRuleBased("issue-1", page.id, "TITLE", "New Title");
    await deps.fixCandidateRepository.saveMany([fixCandidate]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create(deps.project.id, "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = ok({ id: 1, postType: "page", currentTitle: "Old Title", currentExcerpt: "", currentContent: "" });

    const useCase = new AutoApplyApprovedFixesUseCase(deps, new SilentLogger());
    await useCase.execute(deps.auditRun.id);

    expect(fixCandidate.status).toBe("DRAFT");
    expect(deps.wordPressClient.updateTitleCalls).toEqual([]);
  });

  it("does nothing when no WordPress connection exists, even with Otomatik Pilot on", async () => {
    const deps = buildDeps();
    deps.project.setAutoPilotEnabled(true);
    const page = Page.create(deps.crawlJob.id, url("https://example.com/about"));
    await deps.pageRepository.save(deps.project.id, page);
    const fixCandidate = FixCandidate.createRuleBased("issue-1", page.id, "TITLE", "New Title");
    await deps.fixCandidateRepository.saveMany([fixCandidate]);

    const useCase = new AutoApplyApprovedFixesUseCase(deps, new SilentLogger());
    await useCase.execute(deps.auditRun.id);

    expect(fixCandidate.status).toBe("DRAFT");
  });

  it("auto-applies DRAFT TITLE/META_DESCRIPTION candidates when on and connected", async () => {
    const deps = buildDeps();
    deps.project.setAutoPilotEnabled(true);
    const page = Page.create(deps.crawlJob.id, url("https://example.com/about"));
    await deps.pageRepository.save(deps.project.id, page);
    const titleFix = FixCandidate.createRuleBased("issue-1", page.id, "TITLE", "New Title");
    const metaFix = FixCandidate.createRuleBased("issue-2", page.id, "META_DESCRIPTION", "New description");
    await deps.fixCandidateRepository.saveMany([titleFix, metaFix]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create(deps.project.id, "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = ok({ id: 1, postType: "page", currentTitle: "Old Title", currentExcerpt: "Old description", currentContent: "" });

    const useCase = new AutoApplyApprovedFixesUseCase(deps, new SilentLogger());
    await useCase.execute(deps.auditRun.id);

    expect(titleFix.status).toBe("APPLIED");
    expect(metaFix.status).toBe("APPLIED");
    expect(deps.wordPressClient.updateTitleCalls).toHaveLength(1);
    expect(deps.wordPressClient.updateExcerptCalls).toHaveLength(1);
  });

  it("never auto-applies H1/CANONICAL_URL fix types, even when on and connected", async () => {
    const deps = buildDeps();
    deps.project.setAutoPilotEnabled(true);
    const page = Page.create(deps.crawlJob.id, url("https://example.com/about"));
    await deps.pageRepository.save(deps.project.id, page);
    const h1Fix = FixCandidate.createRuleBased("issue-1", page.id, "H1", "New heading");
    await deps.fixCandidateRepository.saveMany([h1Fix]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create(deps.project.id, "https://example.com", "bot", "pw"));

    const useCase = new AutoApplyApprovedFixesUseCase(deps, new SilentLogger());
    await useCase.execute(deps.auditRun.id);

    expect(h1Fix.status).toBe("DRAFT");
  });

  it("skips an already-APPLIED candidate rather than re-applying it", async () => {
    const deps = buildDeps();
    deps.project.setAutoPilotEnabled(true);
    const page = Page.create(deps.crawlJob.id, url("https://example.com/about"));
    await deps.pageRepository.save(deps.project.id, page);
    const titleFix = FixCandidate.createRuleBased("issue-1", page.id, "TITLE", "New Title");
    titleFix.markApplied("Old Title");
    await deps.fixCandidateRepository.saveMany([titleFix]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create(deps.project.id, "https://example.com", "bot", "pw"));

    const useCase = new AutoApplyApprovedFixesUseCase(deps, new SilentLogger());
    await useCase.execute(deps.auditRun.id);

    expect(deps.wordPressClient.updateTitleCalls).toEqual([]);
  });

  it("continues applying remaining candidates after one fails", async () => {
    const deps = buildDeps();
    deps.project.setAutoPilotEnabled(true);
    const page = Page.create(deps.crawlJob.id, url("https://example.com/about"));
    await deps.pageRepository.save(deps.project.id, page);
    const titleFix = FixCandidate.createRuleBased("issue-1", page.id, "TITLE", "New Title");
    const metaFix = FixCandidate.createRuleBased("issue-2", page.id, "META_DESCRIPTION", "New description");
    await deps.fixCandidateRepository.saveMany([titleFix, metaFix]);
    // No WordPress connection seeded for this project — every candidate
    // fails with WORDPRESS_NOT_CONNECTED, but the loop must still finish
    // (and not throw) rather than stopping after the first failure.
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("a-different-project", "https://other.example", "bot", "pw"));

    const useCase = new AutoApplyApprovedFixesUseCase(deps, new SilentLogger());
    await expect(useCase.execute(deps.auditRun.id)).resolves.toBeUndefined();

    expect(titleFix.status).toBe("DRAFT");
    expect(metaFix.status).toBe("DRAFT");
  });
});
