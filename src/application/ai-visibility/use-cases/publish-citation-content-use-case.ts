import type { CitationDraft } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { WordPressConnectionRepositoryPort } from "@/application/wordpress/ports/wordpress-connection-repository-port";
import type { WordPressClientError, WordPressClientPort, WordPressPostRef } from "@/application/wordpress/ports/wordpress-client-port";
import { WordPressNotConnectedError } from "@/application/wordpress/errors";
import { renderDraftHtml } from "@/domain/content-enrichment/services/render-draft-html";
import { err, type Result } from "@/shared/result";

export type PublishCitationContentError = WordPressNotConnectedError | WordPressClientError;

export interface PublishCitationContentDeps {
  wordPressConnectionRepository: WordPressConnectionRepositoryPort;
  wordPressClient: WordPressClientPort;
}

// Pushes a CitationDraft (see GenerateCitationContentUseCase — on-demand,
// never persisted) to WordPress as a brand-new page. Distinct from
// PublishPageContentDraftUseCase in one structural way: that use case
// updates a page that already exists (found via findPostByUrl); citation
// content targets a query/topic with no existing crawled page at all, so
// this always creates a new one instead. Created as a DRAFT in WordPress
// (see WordPressClientPort.createPost), not published outright — a human
// reviews a wholly-new page before it goes live, unlike updating an
// already-live page, where the dashboard's own "Publish" click is already
// the approval.
export class PublishCitationContentUseCase {
  constructor(private readonly deps: PublishCitationContentDeps) {}

  async execute(projectId: string, draft: CitationDraft): Promise<Result<WordPressPostRef, PublishCitationContentError>> {
    const connection = await this.deps.wordPressConnectionRepository.findByProjectId(projectId);
    if (!connection) {
      return err(new WordPressNotConnectedError(`Project "${projectId}" has no WordPress connection`));
    }

    const contentHtml = renderDraftHtml(draft.sections, draft.faqs);

    return this.deps.wordPressClient.createPost(connection, {
      title: draft.title,
      excerpt: draft.metaDescription,
      content: contentHtml,
    });
  }
}
