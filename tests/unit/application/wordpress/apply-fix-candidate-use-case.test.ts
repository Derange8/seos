import { describe, expect, it } from "vitest";
import { ApplyFixCandidateUseCase } from "@/application/wordpress/use-cases/apply-fix-candidate-use-case";
import { WordPressPostNotFoundError } from "@/application/wordpress/ports/wordpress-client-port";
import { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";
import { WordPressConnection } from "@/domain/wordpress/entities/wordpress-connection";
import { ok, err } from "@/shared/result";
import { FakeFixCandidateRepository } from "../fixes/fakes";
import { FakeCrawlJobRepository, FakePageRepository } from "../crawling/fakes";
import { FakeWordPressClient, FakeWordPressConnectionRepository } from "./fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok url");
  return result.value;
}

function buildDeps() {
  const fixCandidateRepository = new FakeFixCandidateRepository();
  const pageRepository = new FakePageRepository();
  const crawlJobRepository = new FakeCrawlJobRepository();
  const wordPressConnectionRepository = new FakeWordPressConnectionRepository();
  const wordPressClient = new FakeWordPressClient();

  const configResult = CrawlConfig.create();
  if (!configResult.ok) throw new Error("expected ok config");
  const crawlJob = CrawlJob.create("project-1", configResult.value);
  crawlJobRepository.seed(crawlJob);

  return { fixCandidateRepository, pageRepository, crawlJobRepository, wordPressConnectionRepository, wordPressClient, crawlJobId: crawlJob.id };
}

describe("ApplyFixCandidateUseCase", () => {
  it("applies a TITLE fix, capturing the previous title for rollback", async () => {
    const deps = buildDeps();
    const page = Page.create(deps.crawlJobId, url("https://example.com/about"));
    await deps.pageRepository.save("project-1", page);
    const fixCandidate = FixCandidate.createRuleBased("issue-1", page.id, "TITLE", "New Title");
    await deps.fixCandidateRepository.saveMany([fixCandidate]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = ok({ id: 1, postType: "page", currentTitle: "Old Title", currentExcerpt: "", currentContent: "" });

    const useCase = new ApplyFixCandidateUseCase(deps);
    const result = await useCase.execute("project-1", fixCandidate.id);

    expect(result.ok).toBe(true);
    expect(fixCandidate.status).toBe("APPLIED");
    expect(fixCandidate.previousValue).toBe("Old Title");
    expect(deps.wordPressClient.updateTitleCalls).toEqual([
      { post: { id: 1, postType: "page", currentTitle: "Old Title", currentExcerpt: "", currentContent: "" }, title: "New Title" },
    ]);
  });

  it("applies a META_DESCRIPTION fix via the WordPress excerpt field, capturing the previous excerpt for rollback", async () => {
    const deps = buildDeps();
    const page = Page.create(deps.crawlJobId, url("https://example.com/about"));
    await deps.pageRepository.save("project-1", page);
    const fixCandidate = FixCandidate.createRuleBased("issue-1", page.id, "META_DESCRIPTION", "A new description");
    await deps.fixCandidateRepository.saveMany([fixCandidate]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = ok({ id: 1, postType: "page", currentTitle: "Title", currentExcerpt: "Old description", currentContent: "" });

    const useCase = new ApplyFixCandidateUseCase(deps);
    const result = await useCase.execute("project-1", fixCandidate.id);

    expect(result.ok).toBe(true);
    expect(fixCandidate.status).toBe("APPLIED");
    expect(fixCandidate.previousValue).toBe("Old description");
    expect(deps.wordPressClient.updateExcerptCalls).toEqual([
      { post: { id: 1, postType: "page", currentTitle: "Title", currentExcerpt: "Old description", currentContent: "" }, excerpt: "A new description" },
    ]);
    expect(deps.wordPressClient.updateTitleCalls).toEqual([]);
  });

  it("returns FIX_CANDIDATE_NOT_FOUND for an unknown id", async () => {
    const deps = buildDeps();
    const useCase = new ApplyFixCandidateUseCase(deps);

    const result = await useCase.execute("project-1", "does-not-exist");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FIX_CANDIDATE_NOT_FOUND");
  });

  it("returns FIX_CANDIDATE_NOT_FOUND when the fix candidate belongs to a different project", async () => {
    const deps = buildDeps();
    const page = Page.create(deps.crawlJobId, url("https://example.com/about"));
    await deps.pageRepository.save("project-1", page);
    const fixCandidate = FixCandidate.createRuleBased("issue-1", page.id, "TITLE", "New Title");
    await deps.fixCandidateRepository.saveMany([fixCandidate]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-2", "https://other.example", "bot", "pw"));

    const useCase = new ApplyFixCandidateUseCase(deps);
    const result = await useCase.execute("project-2", fixCandidate.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FIX_CANDIDATE_NOT_FOUND");
    expect(deps.wordPressClient.updateTitleCalls).toEqual([]);
  });

  it("returns UNSUPPORTED_FIX_TYPE for an H1 fix", async () => {
    const deps = buildDeps();
    const page = Page.create(deps.crawlJobId, url("https://example.com/about"));
    await deps.pageRepository.save("project-1", page);
    const fixCandidate = FixCandidate.createRuleBased("issue-1", page.id, "H1", "A new heading");
    await deps.fixCandidateRepository.saveMany([fixCandidate]);

    const useCase = new ApplyFixCandidateUseCase(deps);
    const result = await useCase.execute("project-1", fixCandidate.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNSUPPORTED_FIX_TYPE");
  });

  it("returns WORDPRESS_NOT_CONNECTED when the project has no connection", async () => {
    const deps = buildDeps();
    const page = Page.create(deps.crawlJobId, url("https://example.com/about"));
    await deps.pageRepository.save("project-1", page);
    const fixCandidate = FixCandidate.createRuleBased("issue-1", page.id, "TITLE", "New Title");
    await deps.fixCandidateRepository.saveMany([fixCandidate]);

    const useCase = new ApplyFixCandidateUseCase(deps);
    const result = await useCase.execute("project-1", fixCandidate.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WORDPRESS_NOT_CONNECTED");
  });

  it("returns FIX_CANDIDATE_ALREADY_APPLIED rather than re-applying", async () => {
    const deps = buildDeps();
    const page = Page.create(deps.crawlJobId, url("https://example.com/about"));
    await deps.pageRepository.save("project-1", page);
    const fixCandidate = FixCandidate.createRuleBased("issue-1", page.id, "TITLE", "New Title");
    fixCandidate.markApplied("Old Title");
    await deps.fixCandidateRepository.saveMany([fixCandidate]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));

    const useCase = new ApplyFixCandidateUseCase(deps);
    const result = await useCase.execute("project-1", fixCandidate.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FIX_CANDIDATE_ALREADY_APPLIED");
    expect(deps.wordPressClient.updateTitleCalls).toEqual([]);
  });

  it("marks the candidate FAILED, not stuck DRAFT, when the WordPress lookup fails", async () => {
    const deps = buildDeps();
    const page = Page.create(deps.crawlJobId, url("https://example.com/about"));
    await deps.pageRepository.save("project-1", page);
    const fixCandidate = FixCandidate.createRuleBased("issue-1", page.id, "TITLE", "New Title");
    await deps.fixCandidateRepository.saveMany([fixCandidate]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = err(new WordPressPostNotFoundError("no matching post"));

    const useCase = new ApplyFixCandidateUseCase(deps);
    const result = await useCase.execute("project-1", fixCandidate.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WORDPRESS_POST_NOT_FOUND");
    expect(fixCandidate.status).toBe("FAILED");
  });

  it("can retry after a FAILED attempt", async () => {
    const deps = buildDeps();
    const page = Page.create(deps.crawlJobId, url("https://example.com/about"));
    await deps.pageRepository.save("project-1", page);
    const fixCandidate = FixCandidate.createRuleBased("issue-1", page.id, "TITLE", "New Title");
    fixCandidate.markFailed();
    await deps.fixCandidateRepository.saveMany([fixCandidate]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = ok({ id: 1, postType: "page", currentTitle: "Old Title", currentExcerpt: "", currentContent: "" });

    const useCase = new ApplyFixCandidateUseCase(deps);
    const result = await useCase.execute("project-1", fixCandidate.id);

    expect(result.ok).toBe(true);
    expect(fixCandidate.status).toBe("APPLIED");
  });
});
