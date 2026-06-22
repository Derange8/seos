import type { Url } from "@/domain/crawling/value-objects/url";
import type { Result } from "@/shared/result";
import type { PageFetchError, PageFetchResult } from "@/application/crawling/ports/page-fetch-result";

export interface RenderOptions {
  timeoutMs?: number;
  waitForSelector?: string;
}

// Full browser rendering (Playwright). Used only for pages flagged by the
// JS-dependency heuristic, or projects that force-enable rendering — runs on
// a separate, lower-concurrency worker fleet (Crawler Engine design §6/§8),
// which is why this is a distinct port from PageFetcherPort rather than a
// mode flag on one port.
export interface PageRendererPort {
  render(url: Url, options?: RenderOptions): Promise<Result<PageFetchResult, PageFetchError>>;
}
