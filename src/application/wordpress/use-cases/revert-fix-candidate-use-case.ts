import type { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import type { FixCandidateRepositoryPort } from "@/application/fixes/ports/fix-candidate-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import type { CrawlJobRepositoryPort } from "@/application/crawling/ports/crawl-job-repository-port";
import type { WordPressConnectionRepositoryPort } from "@/application/wordpress/ports/wordpress-connection-repository-port";
import type { WordPressClientError, WordPressClientPort } from "@/application/wordpress/ports/wordpress-client-port";
import { FixCandidateNotFoundError, WordPressNotConnectedError } from "@/application/wordpress/errors";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class FixCandidateNotAppliedError extends DomainError {
  readonly code = "FIX_CANDIDATE_NOT_APPLIED";
}

export type RevertFixCandidateError =
  | FixCandidateNotFoundError
  | FixCandidateNotAppliedError
  | WordPressNotConnectedError
  | WordPressClientError;

export interface RevertFixCandidateDeps {
  fixCandidateRepository: FixCandidateRepositoryPort;
  pageRepository: PageRepositoryPort;
  crawlJobRepository: CrawlJobRepositoryPort;
  wordPressConnectionRepository: WordPressConnectionRepositoryPort;
  wordPressClient: WordPressClientPort;
}

// The other half of Level 3 autonomy's rollback requirement — pushes
// previousValue (captured by ApplyFixCandidateUseCase at apply time) back
// to WordPress. If the WordPress call itself fails, the candidate is left
// exactly as APPLIED — reverting is "undone" only once the live site
// actually reflects it, never just locally in our own database.
export class RevertFixCandidateUseCase {
  constructor(private readonly deps: RevertFixCandidateDeps) {}

  async execute(projectId: string, fixCandidateId: string): Promise<Result<FixCandidate, RevertFixCandidateError>> {
    const fixCandidate = await this.deps.fixCandidateRepository.findById(fixCandidateId);
    if (!fixCandidate) {
      return err(new FixCandidateNotFoundError(`FixCandidate "${fixCandidateId}" not found`));
    }

    const page = await this.deps.pageRepository.findById(fixCandidate.pageId);
    if (!page) {
      throw new Error(`FixCandidate "${fixCandidateId}" references a missing page "${fixCandidate.pageId}"`);
    }

    // Same cross-tenant guard as ApplyFixCandidateUseCase — see its comment.
    const crawlJob = await this.deps.crawlJobRepository.findById(page.crawlJobId);
    if (!crawlJob || crawlJob.projectId !== projectId) {
      return err(new FixCandidateNotFoundError(`FixCandidate "${fixCandidateId}" not found`));
    }

    if (fixCandidate.status !== "APPLIED" || fixCandidate.previousValue === null) {
      return err(new FixCandidateNotAppliedError(`FixCandidate "${fixCandidateId}" is not currently applied`));
    }

    const connection = await this.deps.wordPressConnectionRepository.findByProjectId(projectId);
    if (!connection) {
      return err(new WordPressNotConnectedError(`Project "${projectId}" has no WordPress connection`));
    }

    const postResult = await this.deps.wordPressClient.findPostByUrl(connection, page.url.href);
    if (!postResult.ok) return postResult;

    const updateResult =
      fixCandidate.type === "TITLE"
        ? await this.deps.wordPressClient.updateTitle(connection, postResult.value, fixCandidate.previousValue)
        : await this.deps.wordPressClient.updateExcerpt(connection, postResult.value, fixCandidate.previousValue);
    if (!updateResult.ok) return updateResult;

    fixCandidate.revert();
    await this.deps.fixCandidateRepository.save(fixCandidate);
    return ok(fixCandidate);
  }
}
