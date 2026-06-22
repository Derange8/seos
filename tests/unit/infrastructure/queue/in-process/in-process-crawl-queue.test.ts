import { describe, expect, it } from "vitest";
import { InProcessCrawlQueue } from "@/infrastructure/queue/in-process/in-process-crawl-queue";
import type { PageTask } from "@/application/crawling/ports/crawl-queue-port";
import { Url } from "@/domain/crawling/value-objects/url";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function task(overrides: Partial<PageTask> = {}): PageTask {
  return {
    crawlJobId: "job-1",
    url: url("https://example.com/"),
    depth: 0,
    discoveredFrom: null,
    ...overrides,
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("InProcessCrawlQueue", () => {
  it("runs an enqueued task through the configured runner", async () => {
    const queue = new InProcessCrawlQueue(5);
    const seen: PageTask[] = [];
    const { promise, resolve } = deferred();
    queue.setRunner(async (t) => {
      seen.push(t);
      resolve();
    });

    await queue.enqueue(task());
    await promise;

    expect(seen).toHaveLength(1);
  });

  it("dedupes the same (crawlJobId, url) pair within one crawl job", async () => {
    const queue = new InProcessCrawlQueue(5);
    const seen: PageTask[] = [];
    queue.setRunner(async (t) => {
      seen.push(t);
    });

    await queue.enqueue(task());
    await queue.enqueue(task());
    await new Promise((r) => setTimeout(r, 20));

    expect(seen).toHaveLength(1);
  });

  it("does not dedupe the same url across different crawl jobs", async () => {
    const queue = new InProcessCrawlQueue(5);
    const seen: PageTask[] = [];
    queue.setRunner(async (t) => {
      seen.push(t);
    });

    await queue.enqueue(task({ crawlJobId: "job-1" }));
    await queue.enqueue(task({ crawlJobId: "job-2" }));
    await new Promise((r) => setTimeout(r, 20));

    expect(seen).toHaveLength(2);
  });

  it("enqueueMany only runs the new tasks once dedup is applied", async () => {
    const queue = new InProcessCrawlQueue(5);
    const seen: PageTask[] = [];
    queue.setRunner(async (t) => {
      seen.push(t);
    });

    await queue.enqueueMany([
      task({ url: url("https://example.com/a") }),
      task({ url: url("https://example.com/b") }),
      task({ url: url("https://example.com/a") }),
    ]);
    await new Promise((r) => setTimeout(r, 20));

    expect(seen).toHaveLength(2);
  });

  it("tracks pending count and decrements it on markTaskFinished", async () => {
    const queue = new InProcessCrawlQueue(5);
    // No runner set yet — tasks sit waiting, so the pending count reflects
    // enqueue activity independent of processing.
    await queue.enqueue(task({ url: url("https://example.com/a") }));
    await queue.enqueue(task({ url: url("https://example.com/b") }));

    expect(await queue.countPendingForCrawlJob("job-1")).toBe(2);

    await queue.markTaskFinished("job-1");
    expect(await queue.countPendingForCrawlJob("job-1")).toBe(1);
  });

  it("re-discovering an already-finished url does not inflate the pending count", async () => {
    const queue = new InProcessCrawlQueue(5);
    queue.setRunner(async () => {});

    await queue.enqueue(task());
    await new Promise((r) => setTimeout(r, 20));
    await queue.markTaskFinished("job-1");
    expect(await queue.countPendingForCrawlJob("job-1")).toBe(0);

    await queue.enqueue(task()); // same url, re-discovered
    expect(await queue.countPendingForCrawlJob("job-1")).toBe(0);
  });

  it("never runs more tasks at once than the configured concurrency", async () => {
    const queue = new InProcessCrawlQueue(2);
    let active = 0;
    let maxActive = 0;
    const releases: Array<() => void> = [];

    queue.setRunner(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active--;
    });

    await queue.enqueueMany([
      task({ url: url("https://example.com/a") }),
      task({ url: url("https://example.com/b") }),
      task({ url: url("https://example.com/c") }),
    ]);
    await new Promise((r) => setTimeout(r, 20));

    expect(maxActive).toBe(2);
    expect(active).toBe(2);

    // Draining one release at a time: freeing a slot dispatches the third
    // waiting task, which pushes its own release callback *after* this
    // loop would otherwise have finished — so drain until nothing's left.
    while (releases.length > 0) {
      releases.shift()!();
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(active).toBe(0);
  });

  it("processes shallower (lower-depth) waiting tasks before deeper ones", async () => {
    const queue = new InProcessCrawlQueue(1); // concurrency 1 makes order observable
    const order: number[] = [];
    let releaseFirst!: () => void;
    let firstStarted = false;

    queue.setRunner(async (t) => {
      order.push(t.depth);
      if (!firstStarted) {
        firstStarted = true;
        // Block the only concurrency slot so the next two enqueues land in
        // `waiting` instead of running immediately, making the depth-sort
        // of the waiting list observable.
        await new Promise<void>((resolve) => (releaseFirst = resolve));
      }
    });

    await queue.enqueue(task({ url: url("https://example.com/a"), depth: 2 }));
    await new Promise((r) => setTimeout(r, 0)); // let the first task actually start and block

    await queue.enqueue(task({ url: url("https://example.com/b"), depth: 0 }));
    await queue.enqueue(task({ url: url("https://example.com/c"), depth: 1 }));

    releaseFirst();
    await new Promise((r) => setTimeout(r, 20));

    expect(order).toEqual([2, 0, 1]);
  });
});
