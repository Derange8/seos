import { AggregateRoot } from "@/shared/aggregate-root";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";
import { CrawlJobCompleted } from "@/domain/crawling/events/crawl-job-completed";
import { CrawlJobFailed } from "@/domain/crawling/events/crawl-job-failed";
import type { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";
import type { Page } from "@/domain/crawling/entities/page";

export type CrawlStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export class CrawlJobStateError extends DomainError {
  readonly code = "INVALID_CRAWL_JOB_STATE";
}

export class CrawlPageLimitReachedError extends DomainError {
  readonly code = "CRAWL_PAGE_LIMIT_REACHED";
}

export interface CrawlJobProps {
  id: string;
  projectId: string;
  config: CrawlConfig;
  status: CrawlStatus;
  pageCount: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  error: string | null;
}

export class CrawlJob extends AggregateRoot {
  private constructor(private readonly props: CrawlJobProps) {
    super();
  }

  static create(projectId: string, config: CrawlConfig): CrawlJob {
    return new CrawlJob({
      id: crypto.randomUUID(),
      projectId,
      config,
      status: "PENDING",
      pageCount: 0,
      startedAt: null,
      finishedAt: null,
      error: null,
    });
  }

  // Rehydrates a CrawlJob from persisted state. The page count is tracked as
  // a counter (not a held-in-memory Page[] collection) precisely because a
  // single crawl job can span 100k+ pages — see Crawler Engine design §7/§8;
  // the actual Page rows are queried separately through PageRepositoryPort.
  static reconstitute(props: CrawlJobProps): CrawlJob {
    return new CrawlJob(props);
  }

  get id(): string {
    return this.props.id;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get config(): CrawlConfig {
    return this.props.config;
  }

  get status(): CrawlStatus {
    return this.props.status;
  }

  get pageCount(): number {
    return this.props.pageCount;
  }

  get startedAt(): Date | null {
    return this.props.startedAt;
  }

  get finishedAt(): Date | null {
    return this.props.finishedAt;
  }

  get error(): string | null {
    return this.props.error;
  }

  start(): Result<void, CrawlJobStateError> {
    if (this.props.status !== "PENDING") {
      return err(
        new CrawlJobStateError(`Cannot start a crawl job in status "${this.props.status}"`)
      );
    }
    this.props.status = "RUNNING";
    this.props.startedAt = new Date();
    return ok(undefined);
  }

  hasReachedPageLimit(): boolean {
    return this.props.pageCount >= this.config.maxPages;
  }

  addPage(page: Page): Result<void, CrawlJobStateError | CrawlPageLimitReachedError> {
    if (page.crawlJobId !== this.id) {
      return err(
        new CrawlJobStateError(`Page belongs to crawl job "${page.crawlJobId}", not "${this.id}"`)
      );
    }
    if (this.props.status !== "RUNNING") {
      return err(
        new CrawlJobStateError(`Cannot add a page to a crawl job in status "${this.props.status}"`)
      );
    }
    if (this.hasReachedPageLimit()) {
      return err(
        new CrawlPageLimitReachedError(
          `Crawl job has reached its page limit of ${this.config.maxPages}`
        )
      );
    }
    this.props.pageCount += 1;
    return ok(undefined);
  }

  complete(): Result<void, CrawlJobStateError> {
    if (this.props.status !== "RUNNING") {
      return err(
        new CrawlJobStateError(`Cannot complete a crawl job in status "${this.props.status}"`)
      );
    }
    this.props.status = "COMPLETED";
    this.props.finishedAt = new Date();
    this.addDomainEvent(new CrawlJobCompleted(this.id, this.projectId));
    return ok(undefined);
  }

  fail(reason: string): Result<void, CrawlJobStateError> {
    if (this.props.status === "COMPLETED" || this.props.status === "FAILED") {
      return err(
        new CrawlJobStateError(`Cannot fail a crawl job in status "${this.props.status}"`)
      );
    }
    this.props.status = "FAILED";
    this.props.finishedAt = new Date();
    this.props.error = reason;
    this.addDomainEvent(new CrawlJobFailed(this.id, this.projectId, reason));
    return ok(undefined);
  }
}
