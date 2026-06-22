import { describe, expect, it } from "vitest";
import { HostRateLimiter } from "@/infrastructure/crawler/rate-limiting/host-rate-limiter";

describe("HostRateLimiter", () => {
  it("resolves immediately for the first call to a never-seen origin", async () => {
    const limiter = new HostRateLimiter();
    const startedAt = Date.now();

    await limiter.waitForTurn("https://example.com", 1000);

    expect(Date.now() - startedAt).toBeLessThan(100);
  });

  it("makes a second call for the same origin wait out the remaining interval", async () => {
    const limiter = new HostRateLimiter();

    await limiter.waitForTurn("https://example.com", 200);
    const startedAt = Date.now();
    await limiter.waitForTurn("https://example.com", 200);

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(150);
  });

  it("tracks different origins independently", async () => {
    const limiter = new HostRateLimiter();

    await limiter.waitForTurn("https://example.com", 1000);
    const startedAt = Date.now();
    await limiter.waitForTurn("https://other.com", 1000);

    expect(Date.now() - startedAt).toBeLessThan(100);
  });

  it("spaces out concurrent callers for the same origin instead of letting them all through at once", async () => {
    const limiter = new HostRateLimiter();
    const startedAt = Date.now();

    await Promise.all([
      limiter.waitForTurn("https://example.com", 100),
      limiter.waitForTurn("https://example.com", 100),
      limiter.waitForTurn("https://example.com", 100),
    ]);

    // Three slots at >=100ms apart means the last one can't resolve before
    // roughly 200ms have passed (slot 0 at ~0ms, slot 1 at ~100ms, slot 2 at ~200ms).
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(180);
  });
});
