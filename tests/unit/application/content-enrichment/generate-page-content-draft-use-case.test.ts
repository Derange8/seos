import { describe, expect, it, vi } from "vitest";
import {
  GeneratePageContentDraftUseCase,
  PageContentDraftGenerationFailedError,
  PageNotFoundError,
} from "@/application/content-enrichment/use-cases/generate-page-content-draft-use-case";
import {
  NoLlmProviderConfiguredError,
  type PageContentDraftPort,
} from "@/application/content-enrichment/ports/page-content-draft-port";
import type { PageContentDraftRepositoryPort } from "@/application/content-enrichment/ports/page-content-draft-repository-port";
import { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";
import { FakeCrawlJobRepository, FakePageRepository } from "../crawling/fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function configValue(): CrawlConfig {
  const result = CrawlConfig.create();
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function fakeResult() {
  return {
    suggestedTitle: "Bromelain Şurubu: Ne İşe Yarar?",
    suggestedMetaDescription: "Bromelain şurubunun faydaları ve kullanımı.",
    bodySections: [{ heading: "Bromelain Nedir?", content: "Ananastan elde edilen bir enzimdir." }],
    faqs: [{ question: "Nasıl kullanılır?", answer: "Günde bir ölçek." }],
  };
}

// FakePageRepository.findByCrawlJobAndUrl returns null by default; this use
// case relies on it, so wrap the fake to resolve a seeded page by URL.
function pageRepoWith(page: Page | null) {
  const repo = new FakePageRepository();
  return Object.assign(repo, {
    findByCrawlJobAndUrl: vi.fn().mockResolvedValue(page),
  });
}

async function deps(
  page: Page | null,
  overrides: Partial<{ pageContentDraft: PageContentDraftPort; pageContentDraftRepository: PageContentDraftRepositoryPort }> = {},
  seedCrawl = true
) {
  const crawlJobRepository = new FakeCrawlJobRepository();
  if (seedCrawl) crawlJobRepository.seed(CrawlJob.create("project-1", configValue()));

  const pageContentDraft: PageContentDraftPort =
    overrides.pageContentDraft ?? ({ generateDraft: vi.fn().mockResolvedValue(fakeResult()) } as PageContentDraftPort);
  const pageContentDraftRepository: PageContentDraftRepositoryPort =
    overrides.pageContentDraftRepository ??
    ({ save: vi.fn().mockResolvedValue(undefined), findByProjectId: vi.fn(), findById: vi.fn() } as PageContentDraftRepositoryPort);

  return { crawlJobRepository, pageRepository: pageRepoWith(page), pageContentDraft, pageContentDraftRepository };
}

describe("GeneratePageContentDraftUseCase", () => {
  it("generates and persists a draft for a page in the latest crawl", async () => {
    const page = Page.create("job-1", url("https://example.com/bromelain"), { title: "Bromelain", contentExcerpt: "x" });
    const dependencies = await deps(page);
    const useCase = new GeneratePageContentDraftUseCase(dependencies);

    const result = await useCase.execute("project-1", "https://example.com/bromelain");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.suggestedTitle).toBe("Bromelain Şurubu: Ne İşe Yarar?");
      expect(result.value.faqs).toHaveLength(1);
    }
    expect(dependencies.pageContentDraftRepository.save).toHaveBeenCalledTimes(1);
  });

  it("passes the page's real content (title/h1/excerpt/faq count) to the LLM port", async () => {
    const page = Page.create("job-1", url("https://example.com/p"), {
      title: "T",
      h1: "H",
      contentExcerpt: "excerpt",
    });
    const dependencies = await deps(page);
    const useCase = new GeneratePageContentDraftUseCase(dependencies);

    await useCase.execute("project-1", "https://example.com/p");

    expect(dependencies.pageContentDraft.generateDraft).toHaveBeenCalledWith({
      pageUrl: "https://example.com/p",
      title: "T",
      h1: "H",
      contentExcerpt: "excerpt",
      existingFaqCount: 0,
    });
  });

  it("fails with PageNotFoundError when the project has never been crawled", async () => {
    const dependencies = await deps(null, {}, false);
    const useCase = new GeneratePageContentDraftUseCase(dependencies);

    const result = await useCase.execute("project-1", "https://example.com/p");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(PageNotFoundError);
  });

  it("fails with PageNotFoundError when the page isn't in the latest crawl", async () => {
    const dependencies = await deps(null);
    const useCase = new GeneratePageContentDraftUseCase(dependencies);

    const result = await useCase.execute("project-1", "https://example.com/missing");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(PageNotFoundError);
    expect(dependencies.pageContentDraft.generateDraft).not.toHaveBeenCalled();
  });

  it("passes through NoLlmProviderConfiguredError from the LLM port", async () => {
    const page = Page.create("job-1", url("https://example.com/p"), { title: "T" });
    const dependencies = await deps(page, {
      pageContentDraft: { generateDraft: vi.fn().mockRejectedValue(new NoLlmProviderConfiguredError("no provider")) },
    });
    const useCase = new GeneratePageContentDraftUseCase(dependencies);

    const result = await useCase.execute("project-1", "https://example.com/p");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NoLlmProviderConfiguredError);
    expect(dependencies.pageContentDraftRepository.save).not.toHaveBeenCalled();
  });

  it("wraps any other LLM failure as PageContentDraftGenerationFailedError", async () => {
    const page = Page.create("job-1", url("https://example.com/p"), { title: "T" });
    const dependencies = await deps(page, {
      pageContentDraft: { generateDraft: vi.fn().mockRejectedValue(new Error("network blip")) },
    });
    const useCase = new GeneratePageContentDraftUseCase(dependencies);

    const result = await useCase.execute("project-1", "https://example.com/p");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PageContentDraftGenerationFailedError);
      expect(result.error.message).toBe("network blip");
    }
  });
});
