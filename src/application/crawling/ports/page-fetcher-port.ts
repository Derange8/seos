import type { Url } from "@/domain/crawling/value-objects/url";
import type { Result } from "@/shared/result";
import type { PageFetchError, PageFetchResult } from "@/application/crawling/ports/page-fetch-result";

// Plain HTTP fetch, no JS execution. The default, cheap fetch path in the
// hybrid rendering strategy (Crawler Engine design §6) — fast, low resource
// cost, runs on a high-concurrency worker fleet.
export interface PageFetcherPort {
  fetch(url: Url): Promise<Result<PageFetchResult, PageFetchError>>;
}
