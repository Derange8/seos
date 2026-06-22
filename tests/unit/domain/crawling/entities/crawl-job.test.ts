import { describe, expect, it } from "vitest";
import { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";
import { isErr, isOk } from "@/shared/result";
import { CrawlJobCompleted } from "@/domain/crawling/events/crawl-job-completed";
import { CrawlJobFailed } from "@/domain/crawling/events/crawl-job-failed";

function url(input: string): Url {
  const result = Url.create(input);
  if (!isOk(result)) throw new Error("expected ok result");
  return result.value;
}

function config(overrides: Partial<{ maxPages: number }> = {}): CrawlConfig {
  const result = CrawlConfig.create(overrides);
  if (!isOk(result)) throw new Error("expected ok result");
  return result.value;
}

describe("CrawlJob", () => {
  it("starts out PENDING with no pages", () => {
    const job = CrawlJob.create("project-1", config());
    expect(job.status).toBe("PENDING");
    expect(job.pageCount).toBe(0);
  });

  it("start() transitions PENDING -> RUNNING and records startedAt", () => {
    const job = CrawlJob.create("project-1", config());
    const result = job.start();
    expect(isOk(result)).toBe(true);
    expect(job.status).toBe("RUNNING");
    expect(job.startedAt).toBeInstanceOf(Date);
  });

  it("start() fails when the job is not PENDING", () => {
    const job = CrawlJob.create("project-1", config());
    job.start();
    const result = job.start();
    expect(isErr(result) && result.error.code).toBe("INVALID_CRAWL_JOB_STATE");
  });

  it("addPage() fails while the job is not RUNNING", () => {
    const job = CrawlJob.create("project-1", config());
    const page = Page.create(job.id, url("https://example.com/"));
    const result = job.addPage(page);
    expect(isErr(result) && result.error.code).toBe("INVALID_CRAWL_JOB_STATE");
  });

  it("addPage() accepts pages once RUNNING", () => {
    const job = CrawlJob.create("project-1", config());
    job.start();
    const page = Page.create(job.id, url("https://example.com/"));
    const result = job.addPage(page);
    expect(isOk(result)).toBe(true);
    expect(job.pageCount).toBe(1);
  });

  it("addPage() rejects a page that belongs to a different crawl job", () => {
    const job = CrawlJob.create("project-1", config());
    job.start();
    const page = Page.create("some-other-job", url("https://example.com/"));
    const result = job.addPage(page);
    expect(isErr(result) && result.error.code).toBe("INVALID_CRAWL_JOB_STATE");
    expect(job.pageCount).toBe(0);
  });

  it("enforces the maxPages invariant", () => {
    const job = CrawlJob.create("project-1", config({ maxPages: 1 }));
    job.start();
    job.addPage(Page.create(job.id, url("https://example.com/a")));
    const result = job.addPage(Page.create(job.id, url("https://example.com/b")));
    expect(isErr(result) && result.error.code).toBe("CRAWL_PAGE_LIMIT_REACHED");
    expect(job.pageCount).toBe(1);
  });

  it("complete() transitions RUNNING -> COMPLETED and emits CrawlJobCompleted", () => {
    const job = CrawlJob.create("project-1", config());
    job.start();
    const result = job.complete();
    expect(isOk(result)).toBe(true);
    expect(job.status).toBe("COMPLETED");
    expect(job.finishedAt).toBeInstanceOf(Date);

    const events = job.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(CrawlJobCompleted);
  });

  it("complete() fails when the job is not RUNNING", () => {
    const job = CrawlJob.create("project-1", config());
    const result = job.complete();
    expect(isErr(result) && result.error.code).toBe("INVALID_CRAWL_JOB_STATE");
  });

  it("fail() records the reason and emits CrawlJobFailed", () => {
    const job = CrawlJob.create("project-1", config());
    job.start();
    const result = job.fail("network timeout");
    expect(isOk(result)).toBe(true);
    expect(job.status).toBe("FAILED");
    expect(job.error).toBe("network timeout");

    const events = job.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(CrawlJobFailed);
  });

  it("fail() cannot be called on an already COMPLETED job", () => {
    const job = CrawlJob.create("project-1", config());
    job.start();
    job.complete();
    const result = job.fail("too late");
    expect(isErr(result)).toBe(true);
  });

  it("pullDomainEvents() drains the event buffer", () => {
    const job = CrawlJob.create("project-1", config());
    job.start();
    job.complete();
    expect(job.pullDomainEvents()).toHaveLength(1);
    expect(job.pullDomainEvents()).toHaveLength(0);
  });

  it("reconstitute() rehydrates a job from persisted state without resetting it", () => {
    const job = CrawlJob.reconstitute({
      id: "job-1",
      projectId: "project-1",
      config: config({ maxPages: 10 }),
      status: "RUNNING",
      pageCount: 7,
      startedAt: new Date("2026-01-01T00:00:00Z"),
      finishedAt: null,
      error: null,
    });

    expect(job.id).toBe("job-1");
    expect(job.status).toBe("RUNNING");
    expect(job.pageCount).toBe(7);
    expect(job.hasReachedPageLimit()).toBe(false);
  });
});
