import type { RobotsPort } from "@/application/crawling/ports/robots-port";
import type { PageFetchError } from "@/application/crawling/ports/page-fetch-result";
import { HttpPageFetcher } from "@/infrastructure/crawler/http/http-page-fetcher";
import { Url } from "@/domain/crawling/value-objects/url";
import { ok, type Result } from "@/shared/result";

interface HttpRobotsFetcherOptions {
  allowPrivateNetworks?: boolean;
}

// Reuses HttpPageFetcher entirely (same SSRF guard, redirect handling,
// timeout) rather than duplicating that logic — a robots.txt request is
// just a GET like any other page fetch, it just gets a special URL and a
// more lenient interpretation of failures (see fetchRobotsTxt).
export class HttpRobotsFetcher implements RobotsPort {
  private readonly fetcher: HttpPageFetcher;

  constructor(options: HttpRobotsFetcherOptions = {}) {
    this.fetcher = new HttpPageFetcher({ allowPrivateNetworks: options.allowPrivateNetworks });
  }

  // Any non-200 outcome — 404, another 4xx/5xx, or a network-level
  // failure — collapses to ok(null) ("no enforceable rules found"). A
  // robots.txt that's merely unreachable must never block or fail an
  // entire crawl; the permissive default is the same one a missing file
  // gets.
  async fetchRobotsTxt(origin: Url): Promise<Result<string | null, PageFetchError>> {
    const robotsUrlResult = Url.create(new URL("/robots.txt", origin.href).href);
    if (!robotsUrlResult.ok) return ok(null);

    const result = await this.fetcher.fetch(robotsUrlResult.value);
    if (!result.ok) return ok(null);
    if (result.value.statusCode >= 400) return ok(null);
    return ok(result.value.html);
  }
}
