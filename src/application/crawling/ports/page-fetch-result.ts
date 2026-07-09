import { DomainError } from "@/shared/domain-error";
import type { Url } from "@/domain/crawling/value-objects/url";

export type RenderMode = "HTTP" | "PLAYWRIGHT";

export interface PageFetchResult {
  finalUrl: Url;
  statusCode: number;
  html: string;
  responseTimeMs: number;
  // Ordered list of intermediate URLs the request was redirected through,
  // not including finalUrl. See Crawler Engine design §9 (redirect loops).
  redirectChain: readonly string[];
  renderMode: RenderMode;
  // Raw Content-Security-Policy response header, null when absent. Feeds
  // the csp-blocks-script rule — whether a page's own CSP would let the
  // browser actually load the external scripts it references is only
  // knowable from this header, not from the HTML alone.
  cspHeader: string | null;
  // Response Content-Type header, stripped of any charset/boundary suffix
  // (e.g. "application/pdf", "text/html"), null when absent. Lets
  // HTML-structure audit rules (missing title/H1/meta, etc.) skip
  // non-HTML resources instead of flagging a PDF for lacking an <h1>.
  contentType: string | null;
}

export type PageFetchErrorCode =
  | "TIMEOUT"
  | "DNS_FAILURE"
  | "TLS_FAILURE"
  | "CONNECTION_ERROR"
  | "REDIRECT_LOOP"
  | "HTTP_ERROR"
  | "BLOCKED_PRIVATE_NETWORK";

export class PageFetchError extends DomainError {
  readonly code: PageFetchErrorCode;

  constructor(code: PageFetchErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
