import type { Url } from "@/domain/crawling/value-objects/url";
import type { Result } from "@/shared/result";
import type { PageFetchError } from "@/application/crawling/ports/page-fetch-result";

// Fetches the raw robots.txt body for an origin. `null` means no robots.txt
// was found (404), which is non-fatal — callers treat it as "everything
// allowed" (Crawler Engine design §2). Parsing the raw text into enforceable
// rules (Disallow/Crawl-delay/Sitemap) is domain/application logic, not an
// I/O concern, so it deliberately is not part of this port.
export interface RobotsPort {
  fetchRobotsTxt(origin: Url): Promise<Result<string | null, PageFetchError>>;
}
