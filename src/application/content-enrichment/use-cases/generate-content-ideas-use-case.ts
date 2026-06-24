import { ContentIdea } from "@/domain/content-enrichment/entities/content-idea";
import type { CrawlJobRepositoryPort } from "@/application/crawling/ports/crawl-job-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import {
  NoLlmProviderConfiguredError,
  type ContentIdeaPort,
  type ContentIdeaSuggestion,
} from "@/application/content-enrichment/ports/content-idea-port";
import type { ContentIdeaRepositoryPort } from "@/application/content-enrichment/ports/content-idea-repository-port";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

// Bounds the single whole-site prompt (a crawl can hold up to 5000 pages).
// This call only sends title + h1 per page, so a count cap alone keeps it
// well inside the context window.
const MAX_PAGES_FOR_SITE_ANALYSIS = 100;

export class NoCrawledPagesError extends DomainError {
  readonly code = "NO_CRAWLED_PAGES";
}

export class ContentIdeaGenerationFailedError extends DomainError {
  readonly code = "CONTENT_IDEA_GENERATION_FAILED";
}

export interface GenerateContentIdeasDeps {
  crawlJobRepository: CrawlJobRepositoryPort;
  pageRepository: PageRepositoryPort;
  contentIdea: ContentIdeaPort;
  contentIdeaRepository: ContentIdeaRepositoryPort;
}

export class GenerateContentIdeasUseCase {
  constructor(private readonly deps: GenerateContentIdeasDeps) {}

  async execute(
    projectId: string
  ): Promise<
    Result<ContentIdea[], NoCrawledPagesError | NoLlmProviderConfiguredError | ContentIdeaGenerationFailedError>
  > {
    const crawlJob = await this.deps.crawlJobRepository.findLatestByProjectId(projectId);
    if (!crawlJob) {
      return err(new NoCrawledPagesError(`Project "${projectId}" has no crawl to derive content ideas from`));
    }

    const pages = await this.deps.pageRepository.findAllByCrawlJobId(crawlJob.id);
    // A page with neither a title nor an H1 carries no usable topic
    // signal — skip it rather than ask the LLM to invent a subject from a
    // bare URL.
    const usablePages = pages.filter(
      (page) => (page.title && page.title.trim().length > 0) || (page.h1 && page.h1.trim().length > 0)
    );
    if (usablePages.length === 0) {
      return err(new NoCrawledPagesError(`Project "${projectId}" has no crawled pages with a usable title or H1`));
    }

    let suggestions: ContentIdeaSuggestion[];
    try {
      suggestions = await this.deps.contentIdea.generateContentIdeas(
        usablePages
          .slice(0, MAX_PAGES_FOR_SITE_ANALYSIS)
          .map((page) => ({ pageUrl: page.url.href, title: page.title, h1: page.h1 }))
      );
    } catch (error) {
      if (error instanceof NoLlmProviderConfiguredError) return err(error);
      return err(new ContentIdeaGenerationFailedError(error instanceof Error ? error.message : String(error)));
    }

    const ideas = suggestions.map((suggestion) =>
      ContentIdea.create(
        projectId,
        suggestion.pageUrl,
        suggestion.topic,
        suggestion.suggestedTitle,
        suggestion.suggestedSlug,
        suggestion.rationale
      )
    );

    await this.deps.contentIdeaRepository.replaceForProject(projectId, ideas);
    return ok(ideas);
  }
}
