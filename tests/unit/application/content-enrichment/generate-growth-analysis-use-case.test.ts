import { describe, expect, it, vi } from "vitest";
import {
  GenerateGrowthAnalysisUseCase,
  GrowthAnalysisGenerationFailedError,
  NoCrawledPagesError,
} from "@/application/content-enrichment/use-cases/generate-growth-analysis-use-case";
import {
  NoLlmProviderConfiguredError,
  type GrowthAnalysisPort,
} from "@/application/content-enrichment/ports/growth-analysis-port";
import type { GrowthAnalysisRepositoryPort } from "@/application/content-enrichment/ports/growth-analysis-repository-port";
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
    businessUnderstanding: "Sells anti-aging skincare and wellness syrups.",
    contentGapsSummary: "No FAQ or usage instructions on any product page.",
    opportunities: [
      {
        title: "What Does Bromelain Do?",
        searchIntent: "Informational",
        whyUsersSearch: "The product page itself asks this question without answering it.",
        whyRevenue: "Links directly back to the product page.",
        suggestedSlug: "/blog/what-does-bromelain-do",
        pageType: "BLOG_ARTICLE" as const,
        priority: "HIGH" as const,
      },
    ],
    conversionOpportunities: [{ pageUrl: "https://example.com/bromelain", recommendation: "Add an FAQ section." }],
    missingCompetitorPages: ["Customer reviews page"],
    topPages: ["FAQ for bromelain syrup"],
    executiveSummary: "Add FAQs, build trust content, bundle related products.",
  };
}

async function seededDeps(
  pages: Page[],
  overrides: Partial<{ growthAnalysis: GrowthAnalysisPort; growthAnalysisRepository: GrowthAnalysisRepositoryPort }> = {}
) {
  const crawlJobRepository = new FakeCrawlJobRepository();
  // Fixed id ("job-1") rather than CrawlJob.create's random one — every
  // page below is created with crawlJobId "job-1" too, and the fake page
  // repository now actually filters by crawlJobId (it used to ignore the
  // parameter and return everything, masking a real id mismatch here).
  const crawlJob = CrawlJob.reconstitute({
    id: "job-1",
    projectId: "project-1",
    config: configValue(),
    status: "COMPLETED",
    pageCount: pages.length,
    startedAt: new Date(),
    finishedAt: new Date(),
    error: null,
  });
  crawlJobRepository.seed(crawlJob);

  const pageRepository = new FakePageRepository();
  for (const page of pages) {
    await pageRepository.save("project-1", page);
  }

  const growthAnalysis: GrowthAnalysisPort =
    overrides.growthAnalysis ?? ({ generateGrowthAnalysis: vi.fn().mockResolvedValue(fakeResult()) } as GrowthAnalysisPort);

  const growthAnalysisRepository: GrowthAnalysisRepositoryPort =
    overrides.growthAnalysisRepository ??
    ({ save: vi.fn().mockResolvedValue(undefined), findByProjectId: vi.fn() } as GrowthAnalysisRepositoryPort);

  return { crawlJobRepository, pageRepository, growthAnalysis, growthAnalysisRepository, crawlJob };
}

describe("GenerateGrowthAnalysisUseCase", () => {
  it("generates and persists a growth analysis from pages with a usable title or H1", async () => {
    const page = Page.create("job-1", url("https://example.com/bromelain"), { title: "Bromelain Syrup" });
    const dependencies = await seededDeps([page]);
    const useCase = new GenerateGrowthAnalysisUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.executiveSummary).toBe("Add FAQs, build trust content, bundle related products.");
      expect(result.value.opportunities).toHaveLength(1);
    }
    expect(dependencies.growthAnalysisRepository.save).toHaveBeenCalledTimes(1);
  });

  it("only sends pages with a usable title or H1 to the LLM port, including content excerpt and FAQ count", async () => {
    const withTitle = Page.create("job-1", url("https://example.com/a"), {
      title: "Has A Title",
      contentExcerpt: "Some real content.",
    });
    const bare = Page.create("job-1", url("https://example.com/b"));
    const dependencies = await seededDeps([withTitle, bare]);
    const useCase = new GenerateGrowthAnalysisUseCase(dependencies);

    await useCase.execute("project-1");

    expect(dependencies.growthAnalysis.generateGrowthAnalysis).toHaveBeenCalledWith([
      {
        pageUrl: "https://example.com/a",
        title: "Has A Title",
        h1: null,
        contentExcerpt: "Some real content.",
        faqCount: 0,
      },
    ]);
  });

  it("caps the page count and trims each excerpt sent to the LLM for a large crawl", async () => {
    const pages = Array.from({ length: 130 }, (_, i) =>
      Page.create("job-1", url(`https://example.com/p${i}`), {
        title: `Page ${i}`,
        contentExcerpt: "x".repeat(2000),
      })
    );
    const dependencies = await seededDeps(pages);
    const useCase = new GenerateGrowthAnalysisUseCase(dependencies);

    await useCase.execute("project-1");

    const sent = (dependencies.growthAnalysis.generateGrowthAnalysis as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sent).toHaveLength(100);
    expect(sent[0].contentExcerpt.length).toBe(600);
  });

  it("fails with NoCrawledPagesError when the project has never been crawled", async () => {
    const useCase = new GenerateGrowthAnalysisUseCase({
      crawlJobRepository: new FakeCrawlJobRepository(),
      pageRepository: new FakePageRepository(),
      growthAnalysis: { generateGrowthAnalysis: vi.fn() },
      growthAnalysisRepository: { save: vi.fn(), findByProjectId: vi.fn() },
    });

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NoCrawledPagesError);
  });

  it("fails with NoCrawledPagesError when no crawled page has a usable title or H1", async () => {
    const bare = Page.create("job-1", url("https://example.com/bare"));
    const dependencies = await seededDeps([bare]);
    const useCase = new GenerateGrowthAnalysisUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NoCrawledPagesError);
    expect(dependencies.growthAnalysis.generateGrowthAnalysis).not.toHaveBeenCalled();
  });

  it("passes through NoLlmProviderConfiguredError from the LLM port", async () => {
    const page = Page.create("job-1", url("https://example.com/a"), { title: "Has A Title" });
    const dependencies = await seededDeps([page], {
      growthAnalysis: { generateGrowthAnalysis: vi.fn().mockRejectedValue(new NoLlmProviderConfiguredError("no provider")) },
    });
    const useCase = new GenerateGrowthAnalysisUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NoLlmProviderConfiguredError);
    expect(dependencies.growthAnalysisRepository.save).not.toHaveBeenCalled();
  });

  it("wraps any other LLM port failure as GrowthAnalysisGenerationFailedError", async () => {
    const page = Page.create("job-1", url("https://example.com/a"), { title: "Has A Title" });
    const dependencies = await seededDeps([page], {
      growthAnalysis: { generateGrowthAnalysis: vi.fn().mockRejectedValue(new Error("network blip")) },
    });
    const useCase = new GenerateGrowthAnalysisUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(GrowthAnalysisGenerationFailedError);
      expect(result.error.message).toBe("network blip");
    }
  });
});
