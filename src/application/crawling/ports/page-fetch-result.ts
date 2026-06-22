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
