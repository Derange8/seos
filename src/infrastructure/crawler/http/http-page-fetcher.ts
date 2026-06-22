import type { PageFetcherPort } from "@/application/crawling/ports/page-fetcher-port";
import { PageFetchError, type PageFetchResult } from "@/application/crawling/ports/page-fetch-result";
import { Url } from "@/domain/crawling/value-objects/url";
import { CRAWLER_USER_AGENT } from "@/domain/crawling/value-objects/crawler-identity";
import { findPrivateNetworkAddress } from "@/infrastructure/crawler/http/private-network-guard";
import { err, ok, type Result } from "@/shared/result";

// See Crawler Engine design §9 (redirect loops): bound the chain instead of
// retrying — retrying a loop just reproduces the same loop.
const MAX_REDIRECTS = 10;

interface HttpPageFetcherOptions {
  timeoutMs?: number;
  userAgent?: string;
  // Defaults to false (blocked) — the production worker never overrides
  // this. Tests that spin up a local HTTP server on 127.0.0.1 set it to
  // true explicitly, so the override is visible at every call site that
  // needs it rather than silently relaxed for "test mode" in general.
  allowPrivateNetworks?: boolean;
}

interface NodeErrorWithCode extends Error {
  code?: string;
  cause?: unknown;
}

export class HttpPageFetcher implements PageFetcherPort {
  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly allowPrivateNetworks: boolean;

  constructor(options: HttpPageFetcherOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.userAgent = options.userAgent ?? CRAWLER_USER_AGENT;
    this.allowPrivateNetworks = options.allowPrivateNetworks ?? false;
  }

  async fetch(url: Url): Promise<Result<PageFetchResult, PageFetchError>> {
    const redirectChain: string[] = [];
    let currentUrl = url.href;
    const startedAt = performance.now();

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (hop === MAX_REDIRECTS) {
        return err(
          new PageFetchError(
            "REDIRECT_LOOP",
            `Exceeded ${MAX_REDIRECTS} redirects starting from "${url.href}"`
          )
        );
      }

      // Re-checked on every hop, not just the first — a remote server can
      // redirect anywhere, including straight at an internal address that
      // the original URL never pointed at (SSRF via redirect).
      if (!this.allowPrivateNetworks) {
        const guardResult = await this.guardAgainstPrivateNetwork(currentUrl);
        if (!guardResult.ok) return guardResult;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      let response: Response;
      try {
        response = await globalThis.fetch(currentUrl, {
          redirect: "manual",
          signal: controller.signal,
          headers: { "User-Agent": this.userAgent },
        });
      } catch (cause) {
        return err(this.toFetchError(cause, currentUrl));
      } finally {
        clearTimeout(timeout);
      }

      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        redirectChain.push(currentUrl);
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      const html = await response.text();
      const finalUrlResult = Url.create(currentUrl);
      if (!finalUrlResult.ok) {
        return err(
          new PageFetchError("CONNECTION_ERROR", `Resolved to an invalid URL "${currentUrl}"`)
        );
      }

      return ok({
        finalUrl: finalUrlResult.value,
        statusCode: response.status,
        html,
        responseTimeMs: Math.round(performance.now() - startedAt),
        redirectChain,
        renderMode: "HTTP",
      });
    }

    // Unreachable: the loop above always returns before exhausting its range.
    return err(new PageFetchError("CONNECTION_ERROR", "Unexpected fetch loop exit"));
  }

  // SSRF guard: resolve the hostname and reject if any of its addresses
  // fall in a private/reserved range — see private-network-guard.ts for
  // why this matters and its DNS-rebinding limitation. A lookup failure
  // here just means "not blocked" — the fetch attempt right after this
  // will surface its own, more specific DNS_FAILURE.
  private async guardAgainstPrivateNetwork(currentUrl: string): Promise<Result<void, PageFetchError>> {
    const hostname = new URL(currentUrl).hostname;
    const blockedAddress = await findPrivateNetworkAddress(hostname);
    if (blockedAddress) {
      return err(
        new PageFetchError(
          "BLOCKED_PRIVATE_NETWORK",
          `Refusing to fetch "${currentUrl}" — resolves to a private/reserved address (${blockedAddress})`
        )
      );
    }
    return ok(undefined);
  }

  private toFetchError(cause: unknown, attemptedUrl: string): PageFetchError {
    if (cause instanceof Error && cause.name === "AbortError") {
      return new PageFetchError("TIMEOUT", `Timed out fetching "${attemptedUrl}"`);
    }

    const code = this.extractErrorCode(cause);
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      return new PageFetchError("DNS_FAILURE", `DNS resolution failed for "${attemptedUrl}"`);
    }
    if (code?.startsWith("CERT_") || code?.startsWith("ERR_TLS") || code === "DEPTH_ZERO_SELF_SIGNED_CERT") {
      return new PageFetchError("TLS_FAILURE", `TLS error fetching "${attemptedUrl}" (${code})`);
    }
    return new PageFetchError(
      "CONNECTION_ERROR",
      `Connection error fetching "${attemptedUrl}"${code ? ` (${code})` : ""}`
    );
  }

  private extractErrorCode(cause: unknown): string | undefined {
    if (!(cause instanceof Error)) return undefined;
    const withCode = cause as NodeErrorWithCode;
    if (withCode.cause instanceof Error) {
      return (withCode.cause as NodeErrorWithCode).code;
    }
    return withCode.code;
  }
}
