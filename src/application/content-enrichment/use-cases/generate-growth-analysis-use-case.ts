import { GrowthAnalysis } from "@/domain/content-enrichment/entities/growth-analysis";
import type { CrawlJobRepositoryPort } from "@/application/crawling/ports/crawl-job-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import {
  NoLlmProviderConfiguredError,
  type GrowthAnalysisPort,
} from "@/application/content-enrichment/ports/growth-analysis-port";
import type { GrowthAnalysisRepositoryPort } from "@/application/content-enrichment/ports/growth-analysis-repository-port";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class NoCrawledPagesError extends DomainError {
  readonly code = "NO_CRAWLED_PAGES";
}

export class GrowthAnalysisGenerationFailedError extends DomainError {
  readonly code = "GROWTH_ANALYSIS_GENERATION_FAILED";
}

export interface GenerateGrowthAnalysisDeps {
  crawlJobRepository: CrawlJobRepositoryPort;
  pageRepository: PageRepositoryPort;
  growthAnalysis: GrowthAnalysisPort;
  growthAnalysisRepository: GrowthAnalysisRepositoryPort;
}

export class GenerateGrowthAnalysisUseCase {
  constructor(private readonly deps: GenerateGrowthAnalysisDeps) {}

  async execute(
    projectId: string
  ): Promise<
    Result<GrowthAnalysis, NoCrawledPagesError | NoLlmProviderConfiguredError | GrowthAnalysisGenerationFailedError>
  > {
    const crawlJob = await this.deps.crawlJobRepository.findLatestByProjectId(projectId);
    if (!crawlJob) {
      return err(new NoCrawledPagesError(`Project "${projectId}" has no crawl to derive a growth analysis from`));
    }

    const pages = await this.deps.pageRepository.findAllByCrawlJobId(crawlJob.id);
    // Same reasoning as GenerateContentIdeasUseCase: a page with neither a
    // title nor an H1 carries no usable signal for the LLM to reason about.
    const usablePages = pages.filter(
      (page) => (page.title && page.title.trim().length > 0) || (page.h1 && page.h1.trim().length > 0)
    );
    if (usablePages.length === 0) {
      return err(new NoCrawledPagesError(`Project "${projectId}" has no crawled pages with a usable title or H1`));
    }

    let result;
    try {
      result = await this.deps.growthAnalysis.generateGrowthAnalysis(
        usablePages.map((page) => ({
          pageUrl: page.url.href,
          title: page.title,
          h1: page.h1,
          contentExcerpt: page.contentExcerpt,
          faqCount: page.faqs.length,
        }))
      );
    } catch (error) {
      if (error instanceof NoLlmProviderConfiguredError) return err(error);
      return err(new GrowthAnalysisGenerationFailedError(error instanceof Error ? error.message : String(error)));
    }

    const analysis = GrowthAnalysis.create(
      projectId,
      result.businessUnderstanding,
      result.contentGapsSummary,
      result.opportunities,
      result.conversionOpportunities,
      result.missingCompetitorPages,
      result.topPages,
      result.executiveSummary
    );

    await this.deps.growthAnalysisRepository.save(analysis);
    return ok(analysis);
  }
}
