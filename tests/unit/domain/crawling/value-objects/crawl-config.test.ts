import { describe, expect, it } from "vitest";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";
import { isErr, isOk } from "@/shared/result";

describe("CrawlConfig", () => {
  it("applies sane defaults when no overrides are given", () => {
    const result = CrawlConfig.create();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.maxDepth).toBe(3);
      expect(result.value.maxPages).toBe(200);
      expect(result.value.respectRobots).toBe(true);
      expect(result.value.concurrency).toBe(2);
      expect(result.value.deepCsrCheck).toBe(false);
      expect(result.value.measureWebVitals).toBe(false);
    }
  });

  it("allows opting into measureWebVitals", () => {
    const result = CrawlConfig.create({ measureWebVitals: true });
    if (isOk(result)) {
      expect(result.value.measureWebVitals).toBe(true);
    } else {
      throw new Error("expected ok result");
    }
  });

  it("allows overriding individual fields", () => {
    const result = CrawlConfig.create({ maxPages: 50, respectRobots: false });
    if (isOk(result)) {
      expect(result.value.maxPages).toBe(50);
      expect(result.value.respectRobots).toBe(false);
      expect(result.value.maxDepth).toBe(3);
    } else {
      throw new Error("expected ok result");
    }
  });

  it("rejects a negative maxDepth", () => {
    const result = CrawlConfig.create({ maxDepth: -1 });
    expect(isErr(result) && result.error.code).toBe("INVALID_CRAWL_CONFIG");
  });

  it("rejects maxPages below 1", () => {
    const result = CrawlConfig.create({ maxPages: 0 });
    expect(isErr(result)).toBe(true);
  });

  it("rejects concurrency below 1", () => {
    const result = CrawlConfig.create({ concurrency: 0 });
    expect(isErr(result)).toBe(true);
  });

  it("rejects a maxDepth above the upper bound", () => {
    const result = CrawlConfig.create({ maxDepth: 11 });
    expect(isErr(result)).toBe(true);
  });

  it("rejects a maxPages above the upper bound", () => {
    const result = CrawlConfig.create({ maxPages: 5_001 });
    expect(isErr(result)).toBe(true);
  });

  it("rejects a concurrency above the upper bound", () => {
    const result = CrawlConfig.create({ concurrency: 11 });
    expect(isErr(result)).toBe(true);
  });
});
