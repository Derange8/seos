import { PageContentDraft } from "@/domain/content-enrichment/entities/page-content-draft";
import { renderDraftContentHtml } from "@/domain/content-enrichment/services/render-draft-html";
import type { PageContentDraftRepositoryPort } from "@/application/content-enrichment/ports/page-content-draft-repository-port";
import type { WordPressConnectionRepositoryPort } from "@/application/wordpress/ports/wordpress-connection-repository-port";
import type { WordPressClientError, WordPressClientPort } from "@/application/wordpress/ports/wordpress-client-port";
import { WordPressNotConnectedError } from "@/application/wordpress/errors";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class PageContentDraftNotFoundError extends DomainError {
  readonly code = "PAGE_CONTENT_DRAFT_NOT_FOUND";
}

export class PageContentDraftAlreadyPublishedError extends DomainError {
  readonly code = "PAGE_CONTENT_DRAFT_ALREADY_PUBLISHED";
}

export type PublishPageContentDraftError =
  | PageContentDraftNotFoundError
  | PageContentDraftAlreadyPublishedError
  | WordPressNotConnectedError
  | WordPressClientError;

export interface PublishPageContentDraftDeps {
  pageContentDraftRepository: PageContentDraftRepositoryPort;
  wordPressConnectionRepository: WordPressConnectionRepositoryPort;
  wordPressClient: WordPressClientPort;
}

// SEO Agent autonomy Level 3 ("apply after approval") for content, not just
// metadata fixes — the click on "Publish" is the approval, same as
// ApplyFixCandidateUseCase's own doc comment. Pushes title, excerpt, and the
// whole rendered body as three sequential WordPress calls (reusing the same
// per-field methods ApplyFixCandidateUseCase already uses, rather than a new
// combined-payload port method) — any failure marks the draft FAILED and
// stops immediately, same as a single-field fix. Known, accepted limitation:
// if the title call succeeds and the excerpt or content call then fails,
// the live post is left with a new title but stale excerpt/content — this
// is surfaced to the user as a FAILED draft they can retry (which
// re-fetches the post and re-sends all three fields), not silently masked.
export class PublishPageContentDraftUseCase {
  constructor(private readonly deps: PublishPageContentDraftDeps) {}

  async execute(projectId: string, draftId: string): Promise<Result<PageContentDraft, PublishPageContentDraftError>> {
    const draft = await this.deps.pageContentDraftRepository.findById(draftId);
    if (!draft || draft.projectId !== projectId) {
      return err(new PageContentDraftNotFoundError(`PageContentDraft "${draftId}" not found`));
    }

    if (draft.status === "PUBLISHED") {
      return err(new PageContentDraftAlreadyPublishedError(`PageContentDraft "${draftId}" is already published — revert it first`));
    }

    const connection = await this.deps.wordPressConnectionRepository.findByProjectId(projectId);
    if (!connection) {
      return err(new WordPressNotConnectedError(`Project "${projectId}" has no WordPress connection`));
    }

    const postResult = await this.deps.wordPressClient.findPostByUrl(connection, draft.pageUrl);
    if (!postResult.ok) {
      draft.markFailed();
      await this.deps.pageContentDraftRepository.save(draft);
      return postResult;
    }
    const post = postResult.value;

    const contentHtml = renderDraftContentHtml(draft);

    const titleResult = await this.deps.wordPressClient.updateTitle(connection, post, draft.suggestedTitle);
    if (!titleResult.ok) {
      draft.markFailed();
      await this.deps.pageContentDraftRepository.save(draft);
      return titleResult;
    }

    const excerptResult = await this.deps.wordPressClient.updateExcerpt(connection, post, draft.suggestedMetaDescription);
    if (!excerptResult.ok) {
      draft.markFailed();
      await this.deps.pageContentDraftRepository.save(draft);
      return excerptResult;
    }

    const contentResult = await this.deps.wordPressClient.updateContent(connection, post, contentHtml);
    if (!contentResult.ok) {
      draft.markFailed();
      await this.deps.pageContentDraftRepository.save(draft);
      return contentResult;
    }

    draft.markPublished(post.currentTitle, post.currentExcerpt, post.currentContent);
    await this.deps.pageContentDraftRepository.save(draft);
    return ok(draft);
  }
}
