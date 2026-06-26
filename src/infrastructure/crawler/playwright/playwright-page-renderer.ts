import { chromium, type Browser, type Request as PlaywrightRequest, type Response as PlaywrightResponse } from "playwright";
import type { PageRendererPort, RenderOptions } from "@/application/crawling/ports/page-renderer-port";
import { PageFetchError, type PageFetchResult } from "@/application/crawling/ports/page-fetch-result";
import { Url } from "@/domain/crawling/value-objects/url";
import { findPrivateNetworkAddress } from "@/infrastructure/crawler/http/private-network-guard";
import { err, ok, type Result } from "@/shared/result";

const DEFAULT_TIMEOUT_MS = 30_000;

interface PlaywrightPageRendererOptions {
  // Defaults to false (blocked) — see HttpPageFetcher's identical option
  // for why. A headless browser is its own SSRF surface (a malicious
  // page's own JS calling fetch()/XHR against an internal address from
  // inside our process, not just the navigation itself), so every request
  // in the context is guarded, not just the initial goto().
  allowPrivateNetworks?: boolean;
}

// Separate worker-fleet target from HttpPageFetcher (Crawler Engine design
// §6/§8) — only invoked for pages the JS-dependency heuristic flags, or
// projects that force rendering. Keeps one Chromium instance alive across
// calls rather than launching a browser per page.
export class PlaywrightPageRenderer implements PageRendererPort {
  private browserPromise: Promise<Browser> | null = null;
  private readonly allowPrivateNetworks: boolean;

  constructor(options: PlaywrightPageRendererOptions = {}) {
    this.allowPrivateNetworks = options.allowPrivateNetworks ?? false;
  }

  async render(
    url: Url,
    options: RenderOptions = {}
  ): Promise<Result<PageFetchResult, PageFetchError>> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const browser = await this.getBrowser();
    const context = await browser.newContext({ userAgent: "SeosBot/1.0 (+https://seos.example/bot)" });
    const startedAt = performance.now();

    if (!this.allowPrivateNetworks) {
      await context.route("**/*", async (route) => {
        const hostname = new URL(route.request().url()).hostname;
        const blockedAddress = await findPrivateNetworkAddress(hostname);
        if (blockedAddress) {
          await route.abort("blockedbyclient");
          return;
        }
        await route.continue();
      });
    }

    try {
      const page = await context.newPage();
      const response = await page.goto(url.href, { waitUntil: "networkidle", timeout: timeoutMs });
      if (!response) {
        return err(new PageFetchError("CONNECTION_ERROR", `No response navigating to "${url.href}"`));
      }

      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: timeoutMs });
      }

      const html = await page.content();
      const finalUrlResult = Url.create(page.url());
      if (!finalUrlResult.ok) {
        return err(
          new PageFetchError(
            "CONNECTION_ERROR",
            `Rendered page resolved to an invalid URL "${page.url()}"`
          )
        );
      }

      return ok({
        finalUrl: finalUrlResult.value,
        statusCode: response.status(),
        html,
        responseTimeMs: Math.round(performance.now() - startedAt),
        redirectChain: this.extractRedirectChain(response),
        renderMode: "PLAYWRIGHT",
        cspHeader: (await response.allHeaders())["content-security-policy"] ?? null,
      });
    } catch (cause) {
      return err(this.toFetchError(cause, url.href));
    } finally {
      await context.close();
    }
  }

  async close(): Promise<void> {
    if (!this.browserPromise) return;
    const browser = await this.browserPromise;
    await browser.close();
    this.browserPromise = null;
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({ headless: true });
    }
    return this.browserPromise;
  }

  private extractRedirectChain(response: PlaywrightResponse): string[] {
    const chain: string[] = [];
    let request: PlaywrightRequest | null = response.request().redirectedFrom();
    while (request) {
      chain.unshift(request.url());
      request = request.redirectedFrom();
    }
    return chain;
  }

  private toFetchError(cause: unknown, attemptedUrl: string): PageFetchError {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (message.includes("net::ERR_BLOCKED_BY_CLIENT")) {
      return new PageFetchError(
        "BLOCKED_PRIVATE_NETWORK",
        `Refusing to navigate to "${attemptedUrl}" — resolves to a private/reserved address`
      );
    }
    if (message.includes("Timeout") || message.includes("exceeded")) {
      return new PageFetchError("TIMEOUT", `Timed out rendering "${attemptedUrl}"`);
    }
    if (message.includes("ERR_NAME_NOT_RESOLVED")) {
      return new PageFetchError("DNS_FAILURE", `DNS resolution failed for "${attemptedUrl}"`);
    }
    if (message.includes("ERR_CERT") || message.includes("SSL")) {
      return new PageFetchError("TLS_FAILURE", `TLS error rendering "${attemptedUrl}"`);
    }
    return new PageFetchError("CONNECTION_ERROR", `Connection error rendering "${attemptedUrl}": ${message}`);
  }
}
