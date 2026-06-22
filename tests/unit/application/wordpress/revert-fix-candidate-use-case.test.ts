import { describe, expect, it } from "vitest";
import { RevertFixCandidateUseCase } from "@/application/wordpress/use-cases/revert-fix-candidate-use-case";
import { WordPressUnreachableError } from "@/application/wordpress/ports/wordpress-client-port";
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

describe("RevertFixCandidateUseCase", () => {
  it("pushes the previous title back to WordPress and reverts to DRAFT", async () => {
    const deps = buildDeps();
    const page = Page.create(deps.crawlJobId, url("https://example.com/about"));
    await deps.pageRepository.save("project-1", page);
    const fixCandidate = FixCandidate.createRuleBased("issue-1", page.id, "TITLE", "New Title");
    fixCandidate.markApplied("Old Title");
    await deps.fixCandidateRepository.saveMany([fixCandidate]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = ok({ id: 1, postType: "page", currentTitle: "New Title", currentExcerpt: "" });

    const useCase = new RevertFixCandidateUseCase(deps);
    const result = await useCase.execute("project-1", fixCandidate.id);

    expect(result.ok).toBe(true);
    expect(fixCandidate.status).toBe("DRAFT");
    expect(fixCandidate.previousValue).toBeNull();
    expect(deps.wordPressClient.updateTitleCalls).toEqual([
      { post: { id: 1, postType: "page", currentTitle: "New Title", currentExcerpt: "" }, title: "Old Title" },
    ]);
  });

  it("pushes the previous excerpt back to WordPress for a META_DESCRIPTION fix", async () => {
    const deps = buildDeps();
    const page = Page.create(deps.crawlJobId, url("https://example.com/about"));
    await deps.pageRepository.save("project-1", page);
    const fixCandidate = FixCandidate.createRuleBased("issue-1", page.id, "META_DESCRIPTION", "New description");
    fixCandidate.markApplied("Old description");
    await deps.fixCandidateRepository.saveMany([fixCandidate]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = ok({ id: 1, postType: "page", currentTitle: "Title", currentExcerpt: "New description" });

    const useCase = new RevertFixCandidateUseCase(deps);
    const result = await useCase.execute("project-1", fixCandidate.id);

    expect(result.ok).toBe(true);
    expect(fixCandidate.status).toBe("DRAFT");
    expect(deps.wordPressClient.updateExcerptCalls).toEqual([
      { post: { id: 1, postType: "page", currentTitle: "Title", currentExcerpt: "New description" }, excerpt: "Old description" },
    ]);
    expect(deps.wordPressClient.updateTitleCalls).toEqual([]);
  });

  it("returns FIX_CANDIDATE_NOT_APPLIED for a DRAFT fix candidate", async () => {
    const deps = buildDeps();
    const page = Page.create(deps.crawlJobId, url("https://example.com/about"));
    await deps.pageRepository.save("project-1", page);
    const fixCandidate = FixCandidate.createRuleBased("issue-1", page.id, "TITLE", "New Title");
    await deps.fixCandidateRepository.saveMany([fixCandidate]);

    const useCase = new RevertFixCandidateUseCase(deps);
    const result = await useCase.execute("project-1", fixCandidate.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("FIX_CANDIDATE_NOT_APPLIED");
  });

  it("leaves the candidate APPLIED when the WordPress push fails", async () => {
    const deps = buildDeps();
    const page = Page.create(deps.crawlJobId, url("https://example.com/about"));
    await deps.pageRepository.save("project-1", page);
    const fixCandidate = FixCandidate.createRuleBased("issue-1", page.id, "TITLE", "New Title");
    fixCandidate.markApplied("Old Title");
    await deps.fixCandidateRepository.saveMany([fixCandidate]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = ok({ id: 1, postType: "page", currentTitle: "New Title", currentExcerpt: "" });
    deps.wordPressClient.updateTitleResult = err(new WordPressUnreachableError("network error"));

    const useCase = new RevertFixCandidateUseCase(deps);
    const result = await useCase.execute("project-1", fixCandidate.id);

    expect(result.ok).toBe(false);
    expect(fixCandidate.status).toBe("APPLIED");
    expect(fixCandidate.previousValue).toBe("Old Title");
  });
});
