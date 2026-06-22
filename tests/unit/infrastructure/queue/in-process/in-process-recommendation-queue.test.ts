import { describe, expect, it } from "vitest";
import { InProcessRecommendationQueue } from "@/infrastructure/queue/in-process/in-process-recommendation-queue";

describe("InProcessRecommendationQueue", () => {
  it("runs an enqueued auditRunId through the configured runner", async () => {
    const queue = new InProcessRecommendationQueue(2);
    const seen: string[] = [];
    queue.setRunner(async (auditRunId) => {
      seen.push(auditRunId);
    });

    await queue.enqueue("run-1");
    await new Promise((r) => setTimeout(r, 10));

    expect(seen).toEqual(["run-1"]);
  });

  it("dedupes the same auditRunId — only ever enriched once", async () => {
    const queue = new InProcessRecommendationQueue(2);
    const seen: string[] = [];
    queue.setRunner(async (auditRunId) => {
      seen.push(auditRunId);
    });

    await queue.enqueue("run-1");
    await queue.enqueue("run-1");
    await new Promise((r) => setTimeout(r, 10));

    expect(seen).toEqual(["run-1"]);
  });

  it("never runs more tasks at once than the configured concurrency", async () => {
    const queue = new InProcessRecommendationQueue(1);
    let active = 0;
    let maxActive = 0;
    const releases: Array<() => void> = [];

    queue.setRunner(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active--;
    });

    await queue.enqueue("run-1");
    await queue.enqueue("run-2");
    await new Promise((r) => setTimeout(r, 10));

    expect(maxActive).toBe(1);

    // Draining one release at a time: freeing the slot dispatches the
    // second waiting task, which pushes its own release callback *after*
    // this loop would otherwise have finished — so drain until empty.
    while (releases.length > 0) {
      releases.shift()!();
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(active).toBe(0);
  });

  it("queues a task if it arrives before a runner is configured", async () => {
    const queue = new InProcessRecommendationQueue(2);
    await queue.enqueue("run-1");

    const seen: string[] = [];
    queue.setRunner(async (auditRunId) => {
      seen.push(auditRunId);
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(seen).toEqual(["run-1"]);
  });
});
