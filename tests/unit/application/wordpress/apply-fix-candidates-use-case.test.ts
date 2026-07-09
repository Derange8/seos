import { describe, expect, it } from "vitest";
import { ApplyFixCandidatesUseCase } from "@/application/wordpress/use-cases/apply-fix-candidates-use-case";
import { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";
import { WordPressConnection } from "@/domain/wordpress/entities/wordpress-connection";
import { ok } from "@/shared/result";
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

describe("ApplyFixCandidatesUseCase", () => {
  it("applies every candidate in the batch and reports each as applied", async () => {
    const deps = buildDeps();
    const pageA = Page.create(deps.crawlJobId, url("https://example.com/a"));
    const pageB = Page.create(deps.crawlJobId, url("https://example.com/b"));
    await deps.pageRepository.save("project-1", pageA);
    await deps.pageRepository.save("project-1", pageB);
    const fixA = FixCandidate.createRuleBased("issue-a", pageA.id, "TITLE", "Title A");
    const fixB = FixCandidate.createRuleBased("issue-b", pageB.id, "TITLE", "Title B");
    await deps.fixCandidateRepository.saveMany([fixA, fixB]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = ok({ id: 1, postType: "page", currentTitle: "Old", currentExcerpt: "", currentContent: "" });

    const useCase = new ApplyFixCandidatesUseCase(deps);
    const results = await useCase.execute("project-1", [fixA.id, fixB.id]);

    expect(results).toEqual([
      { fixCandidateId: fixA.id, status: "applied" },
      { fixCandidateId: fixB.id, status: "applied" },
    ]);
    expect(fixA.status).toBe("APPLIED");
    expect(fixB.status).toBe("APPLIED");
    expect(deps.wordPressClient.updateTitleCalls).toHaveLength(2);
  });

  it("does not abort the batch when one candidate fails — reports each outcome independently", async () => {
    const deps = buildDeps();
    const pageA = Page.create(deps.crawlJobId, url("https://example.com/a"));
    const pageB = Page.create(deps.crawlJobId, url("https://example.com/b"));
    await deps.pageRepository.save("project-1", pageA);
    await deps.pageRepository.save("project-1", pageB);
    // H1 isn't in ApplyFixCandidateUseCase.SUPPORTED_FIX_TYPES — a
    // deterministic, per-candidate way to force one failure without one
    // shared FakeWordPressClient result affecting both candidates.
    const unsupported = FixCandidate.createRuleBased("issue-a", pageA.id, "H1", "New heading");
    const supported = FixCandidate.createRuleBased("issue-b", pageB.id, "TITLE", "Title B");
    await deps.fixCandidateRepository.saveMany([unsupported, supported]);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = ok({ id: 1, postType: "page", currentTitle: "Old", currentExcerpt: "", currentContent: "" });

    const useCase = new ApplyFixCandidatesUseCase(deps);
    const results = await useCase.execute("project-1", [unsupported.id, supported.id]);

    expect(results).toEqual([
      { fixCandidateId: unsupported.id, status: "failed", error: expect.any(String), errorCode: "UNSUPPORTED_FIX_TYPE" },
      { fixCandidateId: supported.id, status: "applied" },
    ]);
    expect(supported.status).toBe("APPLIED");
  });

  it("returns an empty result array for an empty id list", async () => {
    const deps = buildDeps();
    const useCase = new ApplyFixCandidatesUseCase(deps);

    const results = await useCase.execute("project-1", []);

    expect(results).toEqual([]);
  });
});
