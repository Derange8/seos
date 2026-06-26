import type { PageContentDraft } from "@/domain/content-enrichment/entities/page-content-draft";
import type { PageContentDraftRepositoryPort } from "@/application/content-enrichment/ports/page-content-draft-repository-port";
import type { WordPressConnectionRepositoryPort } from "@/application/wordpress/ports/wordpress-connection-repository-port";
import type { WordPressClientError, WordPressClientPort } from "@/application/wordpress/ports/wordpress-client-port";
import { WordPressNotConnectedError } from "@/application/wordpress/errors";
import { PageContentDraftNotFoundError } from "@/application/wordpress/use-cases/publish-page-content-draft-use-case";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class PageContentDraftNotPublishedError extends DomainError {
  readonly code = "PAGE_CONTENT_DRAFT_NOT_PUBLISHED";
}

export type RevertPageContentDraftError =
  | PageContentDraftNotFoundError
  | PageContentDraftNotPublishedError
  | WordPressNotConnectedError
  | WordPressClientError;

export interface RevertPageContentDraftDeps {
  pageContentDraftRepository: PageContentDraftRepositoryPort;
  wordPressConnectionRepository: WordPressConnectionRepositoryPort;
  wordPressClient: WordPressClientPort;
}

// Pushes previousTitle/previousMetaDescription/previousContent (captured by
// PublishPageContentDraftUseCase at publish time) back to WordPress — same
// "undone only once the live site reflects it" rule as
// RevertFixCandidateUseCase: if any WordPress call fails, the draft stays
// exactly PUBLISHED rather than flipping back to DRAFT locally while the
// live site still shows the new content.
export class RevertPageContentDraftUseCase {
  constructor(private readonly deps: RevertPageContentDraftDeps) {}

  async execute(projectId: string, draftId: string): Promise<Result<PageContentDraft, RevertPageContentDraftError>> {
    const draft = await this.deps.pageContentDraftRepository.findById(draftId);
    if (!draft || draft.projectId !== projectId) {
      return err(new PageContentDraftNotFoundError(`PageContentDraft "${draftId}" not found`));
    }

    if (draft.status !== "PUBLISHED" || draft.previousTitle === null || draft.previousMetaDescription === null || draft.previousContent === null) {
      return err(new PageContentDraftNotPublishedError(`PageContentDraft "${draftId}" is not currently published`));
    }

    const connection = await this.deps.wordPressConnectionRepository.findByProjectId(projectId);
    if (!connection) {
      return err(new WordPressNotConnectedError(`Project "${projectId}" has no WordPress connection`));
    }

    const postResult = await this.deps.wordPressClient.findPostByUrl(connection, draft.pageUrl);
    if (!postResult.ok) return postResult;
    const post = postResult.value;

    const titleResult = await this.deps.wordPressClient.updateTitle(connection, post, draft.previousTitle);
    if (!titleResult.ok) return titleResult;

    const excerptResult = await this.deps.wordPressClient.updateExcerpt(connection, post, draft.previousMetaDescription);
    if (!excerptResult.ok) return excerptResult;

    const contentResult = await this.deps.wordPressClient.updateContent(connection, post, draft.previousContent);
    if (!contentResult.ok) return contentResult;

    draft.revert();
    await this.deps.pageContentDraftRepository.save(draft);
    return ok(draft);
  }
}
