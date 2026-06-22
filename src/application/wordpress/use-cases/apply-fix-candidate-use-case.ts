import { FixCandidate, type FixType } from "@/domain/fixes/entities/fix-candidate";
import type { FixCandidateRepositoryPort } from "@/application/fixes/ports/fix-candidate-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import type { CrawlJobRepositoryPort } from "@/application/crawling/ports/crawl-job-repository-port";
import type { WordPressConnectionRepositoryPort } from "@/application/wordpress/ports/wordpress-connection-repository-port";
import type { WordPressClientError, WordPressClientPort } from "@/application/wordpress/ports/wordpress-client-port";
import { FixCandidateNotFoundError, WordPressNotConnectedError } from "@/application/wordpress/errors";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class UnsupportedFixTypeError extends DomainError {
  readonly code = "UNSUPPORTED_FIX_TYPE";
}

export class FixCandidateAlreadyAppliedError extends DomainError {
  readonly code = "FIX_CANDIDATE_ALREADY_APPLIED";
}

export type ApplyFixCandidateError =
  | FixCandidateNotFoundError
  | UnsupportedFixTypeError
  | WordPressNotConnectedError
  | FixCandidateAlreadyAppliedError
  | WordPressClientError;

export interface ApplyFixCandidateDeps {
  fixCandidateRepository: FixCandidateRepositoryPort;
  pageRepository: PageRepositoryPort;
  crawlJobRepository: CrawlJobRepositoryPort;
  wordPressConnectionRepository: WordPressConnectionRepositoryPort;
  wordPressClient: WordPressClientPort;
}

// MVP scope, deliberately narrow: TITLE maps cleanly to WordPress's native
// post_title field via the REST API. META_DESCRIPTION maps to the core
// "excerpt" field — a real, always-writable field, but NOT guaranteed to
// be what the live page's <meta name="description"> tag actually renders
// (that depends on the site's theme/SEO plugin — Yoast/RankMath usually
// override it with their own postmeta). The dashboard surfaces this
// caveat rather than presenting it with TITLE's same unconditional
// confidence. CANONICAL_URL is still SEO-plugin-specific postmeta, and H1
// is usually theme-rendered, not a discrete WP field — writing to either
// without knowing the site's actual setup would be a guess, not a fix.
const SUPPORTED_FIX_TYPES: readonly FixType[] = ["TITLE", "META_DESCRIPTION"];

// SEO Agent autonomy Level 3 ("apply after approval") — the act of calling
// this *is* the approval (see FixCandidate's own doc comment). A failed
// WordPress call marks the candidate FAILED (retryable) rather than
// leaving it stuck DRAFT-forever with no record anything was attempted.
export class ApplyFixCandidateUseCase {
  constructor(private readonly deps: ApplyFixCandidateDeps) {}

  async execute(projectId: string, fixCandidateId: string): Promise<Result<FixCandidate, ApplyFixCandidateError>> {
    const fixCandidate = await this.deps.fixCandidateRepository.findById(fixCandidateId);
    if (!fixCandidate) {
      return err(new FixCandidateNotFoundError(`FixCandidate "${fixCandidateId}" not found`));
    }

    // Only reachable if the FixCandidate's own pageId is corrupt — a
    // genuine invariant violation (every FixCandidate is generated from a
    // real, already-persisted Page), not a recoverable outcome worth a
    // Result branch.
    const page = await this.deps.pageRepository.findById(fixCandidate.pageId);
    if (!page) {
      throw new Error(`FixCandidate "${fixCandidateId}" references a missing page "${fixCandidate.pageId}"`);
    }

    // The fix candidate must actually belong to the given project — without
    // this, a caller authorized for *some* project could apply or revert
    // any other project's fix candidates by id alone. Reported as
    // not-found, not forbidden, so it never confirms another project's
    // fix candidate exists.
    const crawlJob = await this.deps.crawlJobRepository.findById(page.crawlJobId);
    if (!crawlJob || crawlJob.projectId !== projectId) {
      return err(new FixCandidateNotFoundError(`FixCandidate "${fixCandidateId}" not found`));
    }

    if (fixCandidate.status === "APPLIED") {
      return err(new FixCandidateAlreadyAppliedError(`FixCandidate "${fixCandidateId}" is already applied — revert it first`));
    }
    if (!SUPPORTED_FIX_TYPES.includes(fixCandidate.type)) {
      return err(
        new UnsupportedFixTypeError(
          `Applying "${fixCandidate.type}" fixes to WordPress isn't supported yet — only TITLE and META_DESCRIPTION are`
        )
      );
    }

    const connection = await this.deps.wordPressConnectionRepository.findByProjectId(projectId);
    if (!connection) {
      return err(new WordPressNotConnectedError(`Project "${projectId}" has no WordPress connection`));
    }

    const postResult = await this.deps.wordPressClient.findPostByUrl(connection, page.url.href);
    if (!postResult.ok) {
      fixCandidate.markFailed();
      await this.deps.fixCandidateRepository.save(fixCandidate);
      return postResult;
    }

    const previousValue =
      fixCandidate.type === "TITLE" ? postResult.value.currentTitle : postResult.value.currentExcerpt;
    const updateResult =
      fixCandidate.type === "TITLE"
        ? await this.deps.wordPressClient.updateTitle(connection, postResult.value, fixCandidate.content)
        : await this.deps.wordPressClient.updateExcerpt(connection, postResult.value, fixCandidate.content);
    if (!updateResult.ok) {
      fixCandidate.markFailed();
      await this.deps.fixCandidateRepository.save(fixCandidate);
      return updateResult;
    }

    fixCandidate.markApplied(previousValue);
    await this.deps.fixCandidateRepository.save(fixCandidate);
    return ok(fixCandidate);
  }
}
