import { PageContentDraft } from "@/domain/content-enrichment/entities/page-content-draft";
import type { CrawlJobRepositoryPort } from "@/application/crawling/ports/crawl-job-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import {
  NoLlmProviderConfiguredError,
  type PageContentDraftPort,
} from "@/application/content-enrichment/ports/page-content-draft-port";
import type { PageContentDraftRepositoryPort } from "@/application/content-enrichment/ports/page-content-draft-repository-port";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class PageNotFoundError extends DomainError {
  readonly code = "PAGE_NOT_FOUND";
}

export class PageContentDraftGenerationFailedError extends DomainError {
  readonly code = "PAGE_CONTENT_DRAFT_GENERATION_FAILED";
}

export interface GeneratePageContentDraftDeps {
  crawlJobRepository: CrawlJobRepositoryPort;
  pageRepository: PageRepositoryPort;
  pageContentDraft: PageContentDraftPort;
  pageContentDraftRepository: PageContentDraftRepositoryPort;
}

export class GeneratePageContentDraftUseCase {
  constructor(private readonly deps: GeneratePageContentDraftDeps) {}

  async execute(
    projectId: string,
    pageUrl: string
  ): Promise<
    Result<PageContentDraft, PageNotFoundError | NoLlmProviderConfiguredError | PageContentDraftGenerationFailedError>
  > {
    // Resolve the page against the latest crawl only — a draft should reflect
    // the page as it currently is, not a stale earlier crawl of it.
    const crawlJob = await this.deps.crawlJobRepository.findLatestByProjectId(projectId);
    if (!crawlJob) {
      return err(new PageNotFoundError(`Project "${projectId}" has no crawl containing "${pageUrl}"`));
    }

    const page = await this.deps.pageRepository.findByCrawlJobAndUrl(crawlJob.id, pageUrl);
    if (!page) {
      return err(new PageNotFoundError(`Page "${pageUrl}" not found in the latest crawl of project "${projectId}"`));
    }

    let result;
    try {
      result = await this.deps.pageContentDraft.generateDraft({
        pageUrl: page.url.href,
        title: page.title,
        h1: page.h1,
        contentExcerpt: page.contentExcerpt,
        existingFaqCount: page.faqs.length,
      });
    } catch (error) {
      if (error instanceof NoLlmProviderConfiguredError) return err(error);
      return err(new PageContentDraftGenerationFailedError(error instanceof Error ? error.message : String(error)));
    }

    const draft = PageContentDraft.create(
      projectId,
      page.url.href,
      result.suggestedTitle,
      result.suggestedMetaDescription,
      result.bodySections,
      result.faqs
    );

    await this.deps.pageContentDraftRepository.save(draft);
    return ok(draft);
  }
}
