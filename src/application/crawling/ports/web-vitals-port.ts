import type { Url } from "@/domain/crawling/value-objects/url";
import type { Result } from "@/shared/result";
import type { PageFetchError } from "@/application/crawling/ports/page-fetch-result";

export interface WebVitalsMeasurement {
  // Largest Contentful Paint, in ms — time until the largest visible
  // element (image or text block) finishes rendering.
  lcpMs: number;
  // Cumulative Layout Shift — unitless score, sum of individual layout
  // shift scores for every unexpected shift during the page's lifecycle.
  cls: number;
  // Total Blocking Time, in ms — the lab-measurable proxy for INP
  // (Interaction to Next Paint) that Lighthouse itself uses. INP requires
  // a real user interaction (click/keypress) to measure at all, which an
  // unattended crawler never produces — TBT measures main-thread blocking
  // from long tasks during load instead, without needing one.
  tbtMs: number;
}

// Real browser performance measurement (Playwright + the Performance/
// PerformanceObserver APIs) — a separate concern from PageRendererPort
// (which captures page *content* for parsing): this captures page *timing*
// for the Core Web Vitals audit rules. Kept as its own port rather than
// folded into PageRendererPort's result so plain content rendering never
// pays this measurement's extra wait cost when CrawlConfig.measureWebVitals
// is off.
export interface WebVitalsPort {
  measure(url: Url): Promise<Result<WebVitalsMeasurement, PageFetchError>>;
}
