import { chromium, type Browser } from "playwright";
import type { WebVitalsPort, WebVitalsMeasurement } from "@/application/crawling/ports/web-vitals-port";
import { PageFetchError } from "@/application/crawling/ports/page-fetch-result";
import type { Url } from "@/domain/crawling/value-objects/url";
import { findPrivateNetworkAddress } from "@/infrastructure/crawler/http/private-network-guard";
import { err, ok, type Result } from "@/shared/result";

const DEFAULT_TIMEOUT_MS = 30_000;
// Extra settle time after "networkidle" before reading back the collected
// metrics — LCP in particular can still update for a brief window after
// the network goes quiet (e.g. a late CSS-triggered repaint of the largest
// element), and PerformanceObserver's LCP entries stop arriving once the
// page receives its first user input/scroll, which never happens here, so
// nothing else would otherwise tell us "done collecting."
const SETTLE_MS = 1_000;

interface PlaywrightWebVitalsMeasurerOptions {
  allowPrivateNetworks?: boolean;
}

// Injected into the page before navigation — plain browser Performance/
// PerformanceObserver APIs only, no web-vitals npm package, since LCP/CLS/
// long-task collection this narrow doesn't need the library's full
// event-lifecycle handling (that library mainly earns its keep by also
// tracking real user interaction for INP, which isn't reachable from an
// unattended crawl anyway — see WebVitalsMeasurement.tbtMs).
const COLLECTOR_SCRIPT = `
  window.__seosVitals = { lcp: 0, cls: 0, longTaskMs: 0 };
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) window.__seosVitals.lcp = last.startTime + (last.duration ?? 0);
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__seosVitals.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__seosVitals.longTaskMs += Math.max(0, entry.duration - 50);
      }
    }).observe({ type: "longtask", buffered: true });
  } catch {}
`;

// Separate worker/measurement path from PlaywrightPageRenderer — only
// invoked when CrawlConfig.measureWebVitals is on (see CrawlConfig), since
// every measured page pays a real navigation + a deliberate settle delay
// on top of it, which a plain content-rendering crawl shouldn't have to.
export class PlaywrightWebVitalsMeasurer implements WebVitalsPort {
  private browserPromise: Promise<Browser> | null = null;
  private readonly allowPrivateNetworks: boolean;

  constructor(options: PlaywrightWebVitalsMeasurerOptions = {}) {
    this.allowPrivateNetworks = options.allowPrivateNetworks ?? false;
  }

  async measure(url: Url): Promise<Result<WebVitalsMeasurement, PageFetchError>> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({ userAgent: "SeosBot/1.0 (+https://seos.example/bot)" });

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
      await page.addInitScript(COLLECTOR_SCRIPT);

      const response = await page.goto(url.href, { waitUntil: "networkidle", timeout: DEFAULT_TIMEOUT_MS });
      if (!response) {
        return err(new PageFetchError("CONNECTION_ERROR", `No response navigating to "${url.href}"`));
      }

      await page.waitForTimeout(SETTLE_MS);

      const collected = await page.evaluate(
        () => (window as unknown as { __seosVitals: { lcp: number; cls: number; longTaskMs: number } }).__seosVitals
      );

      const measurement: WebVitalsMeasurement = {
        lcpMs: Math.round(collected.lcp),
        cls: Math.round(collected.cls * 1000) / 1000,
        tbtMs: Math.round(collected.longTaskMs),
      };
      return ok(measurement);
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

  private toFetchError(cause: unknown, attemptedUrl: string): PageFetchError {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (message.includes("net::ERR_BLOCKED_BY_CLIENT")) {
      return new PageFetchError(
        "BLOCKED_PRIVATE_NETWORK",
        `Refusing to navigate to "${attemptedUrl}" — resolves to a private/reserved address`
      );
    }
    if (message.includes("Timeout") || message.includes("exceeded")) {
      return new PageFetchError("TIMEOUT", `Timed out measuring web vitals for "${attemptedUrl}"`);
    }
    if (message.includes("ERR_NAME_NOT_RESOLVED")) {
      return new PageFetchError("DNS_FAILURE", `DNS resolution failed for "${attemptedUrl}"`);
    }
    if (message.includes("ERR_CERT") || message.includes("SSL")) {
      return new PageFetchError("TLS_FAILURE", `TLS error measuring web vitals for "${attemptedUrl}"`);
    }
    return new PageFetchError(
      "CONNECTION_ERROR",
      `Connection error measuring web vitals for "${attemptedUrl}": ${message}`
    );
  }
}
