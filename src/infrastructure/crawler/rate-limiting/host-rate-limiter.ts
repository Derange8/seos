import type { RateLimiterPort } from "@/application/crawling/ports/rate-limiter-port";

// In-process, per-origin politeness throttle. Calls for the same origin
// are chained so that concurrent callers (the crawl queue runs several
// PageTasks in parallel — see InProcessCrawlQueue) still get spaced-out
// turns instead of all computing "wait until X" from the same stale
// timestamp and then all firing at once. This deliberately caps real
// request throughput to one per minIntervalMs *regardless* of the crawl's
// concurrency setting — concurrency controls how many requests can be in
// flight, this controls how often a new one is allowed to start, and the
// latter is what actually protects the target site from being hammered.
export class HostRateLimiter implements RateLimiterPort {
  private readonly nextAvailableAt = new Map<string, number>();
  private readonly chains = new Map<string, Promise<void>>();

  async waitForTurn(origin: string, minIntervalMs: number): Promise<void> {
    const previous = this.chains.get(origin) ?? Promise.resolve();
    const next = previous.then(() => this.reserveSlot(origin, minIntervalMs));
    this.chains.set(origin, next);
    return next;
  }

  private async reserveSlot(origin: string, minIntervalMs: number): Promise<void> {
    const now = Date.now();
    const earliest = this.nextAvailableAt.get(origin) ?? 0;
    const scheduledAt = Math.max(now, earliest);
    this.nextAvailableAt.set(origin, scheduledAt + minIntervalMs);

    const delay = scheduledAt - now;
    if (delay > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
}
