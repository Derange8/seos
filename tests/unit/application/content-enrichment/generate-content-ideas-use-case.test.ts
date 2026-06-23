import { describe, expect, it, vi } from "vitest";
import {
  ContentIdeaGenerationFailedError,
  GenerateContentIdeasUseCase,
  NoCrawledPagesError,
} from "@/application/content-enrichment/use-cases/generate-content-ideas-use-case";
import { NoLlmProviderConfiguredError, type ContentIdeaPort } from "@/application/content-enrichment/ports/content-idea-port";
import type { ContentIdeaRepositoryPort } from "@/application/content-enrichment/ports/content-idea-repository-port";
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

async function seededDeps(
  pages: Page[],
  overrides: Partial<{ contentIdea: ContentIdeaPort; contentIdeaRepository: ContentIdeaRepositoryPort }> = {}
) {
  const crawlJobRepository = new FakeCrawlJobRepository();
  const crawlJob = CrawlJob.create("project-1", configValue());
  crawlJobRepository.seed(crawlJob);

  const pageRepository = new FakePageRepository();
  for (const page of pages) {
    await pageRepository.save("project-1", page);
  }

  const contentIdea: ContentIdeaPort =
    overrides.contentIdea ??
    ({
      generateContentIdeas: vi.fn().mockResolvedValue([
        {
          pageUrl: "https://example.com/bromelain-syrup",
          topic: "Bromelain Syrup",
          suggestedTitle: "What Does Bromelain Do?",
          suggestedSlug: "/blog/what-does-bromelain-do",
          rationale: "Common informational question for this product category.",
        },
      ]),
    } as ContentIdeaPort);

  const contentIdeaRepository: ContentIdeaRepositoryPort =
    overrides.contentIdeaRepository ??
    ({ replaceForProject: vi.fn().mockResolvedValue(undefined), findByProjectId: vi.fn() } as ContentIdeaRepositoryPort);

  return { crawlJobRepository, pageRepository, contentIdea, contentIdeaRepository, crawlJob };
}

describe("GenerateContentIdeasUseCase", () => {
  it("generates and persists content ideas from pages with a usable title or H1", async () => {
    const page = Page.create("job-1", url("https://example.com/bromelain-syrup"), { title: "Bromelain Syrup" });
    const dependencies = await seededDeps([page]);
    const useCase = new GenerateContentIdeasUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.suggestedSlug).toBe("/blog/what-does-bromelain-do");
    }
    expect(dependencies.contentIdeaRepository.replaceForProject).toHaveBeenCalledTimes(1);
  });

  it("only sends pages with a usable title or H1 to the LLM port", async () => {
    const withTitle = Page.create("job-1", url("https://example.com/a"), { title: "Has A Title" });
    const bare = Page.create("job-1", url("https://example.com/b"));
    const dependencies = await seededDeps([withTitle, bare]);
    const useCase = new GenerateContentIdeasUseCase(dependencies);

    await useCase.execute("project-1");

    expect(dependencies.contentIdea.generateContentIdeas).toHaveBeenCalledWith([
      { pageUrl: "https://example.com/a", title: "Has A Title", h1: null },
    ]);
  });

  it("fails with NoCrawledPagesError when the project has never been crawled", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const useCase = new GenerateContentIdeasUseCase({
      crawlJobRepository,
      pageRepository: new FakePageRepository(),
      contentIdea: { generateContentIdeas: vi.fn() },
      contentIdeaRepository: { replaceForProject: vi.fn(), findByProjectId: vi.fn() },
    });

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NoCrawledPagesError);
  });

  it("fails with NoCrawledPagesError when no crawled page has a usable title or H1", async () => {
    const bare = Page.create("job-1", url("https://example.com/bare"));
    const dependencies = await seededDeps([bare]);
    const useCase = new GenerateContentIdeasUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NoCrawledPagesError);
    expect(dependencies.contentIdea.generateContentIdeas).not.toHaveBeenCalled();
  });

  it("passes through NoLlmProviderConfiguredError from the LLM port", async () => {
    const page = Page.create("job-1", url("https://example.com/a"), { title: "Has A Title" });
    const dependencies = await seededDeps([page], {
      contentIdea: { generateContentIdeas: vi.fn().mockRejectedValue(new NoLlmProviderConfiguredError("no provider")) },
    });
    const useCase = new GenerateContentIdeasUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NoLlmProviderConfiguredError);
    expect(dependencies.contentIdeaRepository.replaceForProject).not.toHaveBeenCalled();
  });

  it("wraps any other LLM port failure as ContentIdeaGenerationFailedError", async () => {
    const page = Page.create("job-1", url("https://example.com/a"), { title: "Has A Title" });
    const dependencies = await seededDeps([page], {
      contentIdea: { generateContentIdeas: vi.fn().mockRejectedValue(new Error("network blip")) },
    });
    const useCase = new GenerateContentIdeasUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ContentIdeaGenerationFailedError);
      expect(result.error.message).toBe("network blip");
    }
  });
});
