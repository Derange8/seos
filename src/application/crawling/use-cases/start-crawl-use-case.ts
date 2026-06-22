import { CrawlJob, type CrawlJobStateError } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig, type CrawlConfigProps, type InvalidCrawlConfigError } from "@/domain/crawling/value-objects/crawl-config";
import type { Url } from "@/domain/crawling/value-objects/url";
import { ProjectNotFoundError } from "@/domain/projects/entities/project";
import { DomainError } from "@/shared/domain-error";
import type { CrawlJobRepositoryPort } from "@/application/crawling/ports/crawl-job-repository-port";
import type { CrawlQueuePort } from "@/application/crawling/ports/crawl-queue-port";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";
import { ok, err, type Result } from "@/shared/result";

export class DomainNotVerifiedError extends DomainError {
  readonly code = "DOMAIN_NOT_VERIFIED";
}

export class CrawlAlreadyInProgressError extends DomainError {
  readonly code = "CRAWL_ALREADY_IN_PROGRESS";
}

export interface StartCrawlDeps {
  crawlJobRepository: CrawlJobRepositoryPort;
  projectRepository: ProjectRepositoryPort;
  queue: CrawlQueuePort;
}

export class StartCrawlUseCase {
  constructor(private readonly deps: StartCrawlDeps) {}

  async execute(
    projectId: string,
    rootUrl: Url,
    configOverrides: Partial<CrawlConfigProps> = {}
  ): Promise<
    Result<
      CrawlJob,
      | InvalidCrawlConfigError
      | CrawlJobStateError
      | ProjectNotFoundError
      | DomainNotVerifiedError
      | CrawlAlreadyInProgressError
    >
  > {
    const project = await this.deps.projectRepository.findById(projectId);
    if (!project) {
      return err(new ProjectNotFoundError(`Project "${projectId}" not found`));
    }
    // Multi-tenant SaaS: a verified owner may crawl their domain, but
    // verification is required first (Crawler Engine design §1/§2 — the
    // crawler must never be usable as an anonymous third-party site scraper).
    if (!project.isVerified) {
      return err(
        new DomainNotVerifiedError(`Project "${projectId}" has not verified ownership of its domain yet`)
      );
    }

    // One active crawl per project at a time — without this, nothing stops
    // a caller (or an impatient double-click) from spawning many concurrent
    // CrawlJobs for the same project, each with its own root task fanning
    // out further work on the same queue/worker.
    const activeJob = await this.deps.crawlJobRepository.findActiveByProjectId(projectId);
    if (activeJob) {
      return err(
        new CrawlAlreadyInProgressError(`Project "${projectId}" already has a crawl in progress`)
      );
    }

    const configResult = CrawlConfig.create(configOverrides);
    if (!configResult.ok) return configResult;

    const crawlJob = CrawlJob.create(projectId, configResult.value);
    const startResult = crawlJob.start();
    if (!startResult.ok) return startResult;

    await this.deps.crawlJobRepository.save(crawlJob);
    await this.deps.queue.enqueue({
      crawlJobId: crawlJob.id,
      url: rootUrl,
      depth: 0,
      discoveredFrom: null,
    });

    return ok(crawlJob);
  }
}
