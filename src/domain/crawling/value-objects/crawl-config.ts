import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class InvalidCrawlConfigError extends DomainError {
  readonly code = "INVALID_CRAWL_CONFIG";
}

export interface CrawlConfigProps {
  maxDepth: number;
  maxPages: number;
  respectRobots: boolean;
  concurrency: number;
  // Off by default: doubles the fetch cost per page (a raw HTTP fetch AND
  // a full Playwright render, even for pages the JS-rendering heuristic
  // wouldn't otherwise escalate) in exchange for detecting content that
  // only exists after client-side JS runs — see
  // ProcessPageTaskUseCase/client-side-only-content-rule. A user opts in
  // knowing that trade-off; it's not worth paying by default on every crawl.
  deepCsrCheck: boolean;
}

const DEFAULTS: CrawlConfigProps = {
  maxDepth: 3,
  maxPages: 200,
  respectRobots: true,
  concurrency: 2,
  deepCsrCheck: false,
};

// Upper bounds, not just lower ones — an API caller could otherwise
// request e.g. maxPages: 10_000_000 or concurrency: 1000, which would
// hammer both the target site and Seos's own single-process worker/queue.
// These aren't "the largest crawl Seos could ever support" (that's a
// scaling question for a future multi-worker design), just a sane ceiling
// on what one request is allowed to ask for today.
const MAX_DEPTH_LIMIT = 10;
const MAX_PAGES_LIMIT = 5_000;
const MAX_CONCURRENCY_LIMIT = 10;

export class CrawlConfig {
  private constructor(private readonly props: CrawlConfigProps) {}

  static create(
    overrides: Partial<CrawlConfigProps> = {}
  ): Result<CrawlConfig, InvalidCrawlConfigError> {
    const props: CrawlConfigProps = { ...DEFAULTS, ...overrides };

    if (props.maxDepth < 0) {
      return err(new InvalidCrawlConfigError("maxDepth must be >= 0"));
    }
    if (props.maxDepth > MAX_DEPTH_LIMIT) {
      return err(new InvalidCrawlConfigError(`maxDepth must be <= ${MAX_DEPTH_LIMIT}`));
    }
    if (props.maxPages < 1) {
      return err(new InvalidCrawlConfigError("maxPages must be >= 1"));
    }
    if (props.maxPages > MAX_PAGES_LIMIT) {
      return err(new InvalidCrawlConfigError(`maxPages must be <= ${MAX_PAGES_LIMIT}`));
    }
    if (props.concurrency < 1) {
      return err(new InvalidCrawlConfigError("concurrency must be >= 1"));
    }
    if (props.concurrency > MAX_CONCURRENCY_LIMIT) {
      return err(new InvalidCrawlConfigError(`concurrency must be <= ${MAX_CONCURRENCY_LIMIT}`));
    }

    return ok(new CrawlConfig(props));
  }

  get maxDepth(): number {
    return this.props.maxDepth;
  }

  get maxPages(): number {
    return this.props.maxPages;
  }

  get respectRobots(): boolean {
    return this.props.respectRobots;
  }

  get concurrency(): number {
    return this.props.concurrency;
  }

  get deepCsrCheck(): boolean {
    return this.props.deepCsrCheck;
  }

  toJSON(): CrawlConfigProps {
    return { ...this.props };
  }
}
