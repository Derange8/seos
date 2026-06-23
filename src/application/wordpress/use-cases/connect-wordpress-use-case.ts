import { WordPressConnection } from "@/domain/wordpress/entities/wordpress-connection";
import { DomainNotVerifiedError, ProjectNotFoundError } from "@/domain/projects/entities/project";
import type { WordPressConnectionRepositoryPort } from "@/application/wordpress/ports/wordpress-connection-repository-port";
import type { WordPressClientError, WordPressClientPort } from "@/application/wordpress/ports/wordpress-client-port";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class InvalidSiteUrlError extends DomainError {
  readonly code = "INVALID_SITE_URL";
}

export class InvalidWordPressCredentialsError extends DomainError {
  readonly code = "INVALID_WORDPRESS_CREDENTIALS";
}

export interface ConnectWordPressDeps {
  projectRepository: ProjectRepositoryPort;
  wordPressClient: WordPressClientPort;
  wordPressConnectionRepository: WordPressConnectionRepositoryPort;
}

// Tests the connection before persisting it — a saved connection should
// always actually work, so there's no separate "verified" flag to model
// (unlike domain ownership verification, which is inherently async and
// benefits from a re-checkable state). Saving twice for the same project
// overwrites the previous connection (see PrismaWordPressConnectionRepository's
// upsert) — reconnecting with new credentials is the only way to change them.
export class ConnectWordPressUseCase {
  constructor(private readonly deps: ConnectWordPressDeps) {}

  async execute(
    projectId: string,
    siteUrlInput: string,
    usernameInput: string,
    applicationPasswordInput: string
  ): Promise<
    Result<
      WordPressConnection,
      | InvalidSiteUrlError
      | InvalidWordPressCredentialsError
      | WordPressClientError
      | ProjectNotFoundError
      | DomainNotVerifiedError
    >
  > {
    const project = await this.deps.projectRepository.findById(projectId);
    if (!project) {
      return err(new ProjectNotFoundError(`Project "${projectId}" not found`));
    }
    // This is the point that actually matters: storing credentials and
    // pushing real changes to a live site requires proof you're allowed to
    // — unlike crawling, which is read-only (see StartCrawlUseCase).
    if (!project.isVerified) {
      return err(
        new DomainNotVerifiedError(`Project "${projectId}" has not verified ownership of its domain yet`)
      );
    }

    const siteUrlResult = this.normalizeSiteUrl(siteUrlInput);
    if (!siteUrlResult.ok) return siteUrlResult;

    const username = usernameInput.trim();
    if (username.length === 0) {
      return err(new InvalidWordPressCredentialsError("username must not be empty"));
    }
    const applicationPassword = applicationPasswordInput.trim();
    if (applicationPassword.length === 0) {
      return err(new InvalidWordPressCredentialsError("applicationPassword must not be empty"));
    }

    const connection = WordPressConnection.create(projectId, siteUrlResult.value, username, applicationPassword);

    const testResult = await this.deps.wordPressClient.testConnection(connection);
    if (!testResult.ok) return testResult;

    await this.deps.wordPressConnectionRepository.save(connection);
    return ok(connection);
  }

  private normalizeSiteUrl(input: string): Result<string, InvalidSiteUrlError> {
    const trimmed = input.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return err(new InvalidSiteUrlError(`"${input}" is not a valid URL`));
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return err(new InvalidSiteUrlError(`"${input}" must use http or https`));
    }
    // Preserve a subdirectory install path (e.g. "https://example.com/blog")
    // but drop a trailing slash and any query/hash — origin alone would
    // silently break sites not installed at the domain root.
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
    return ok(`${parsed.origin}${path}`);
  }
}
