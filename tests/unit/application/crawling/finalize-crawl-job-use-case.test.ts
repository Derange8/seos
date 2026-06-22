import { describe, expect, it } from "vitest";
import { FinalizeCrawlJobIfDoneUseCase } from "@/application/crawling/use-cases/finalize-crawl-job-use-case";
import { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { CrawlJobCompleted } from "@/domain/crawling/events/crawl-job-completed";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";
import { DomainEventDispatcher } from "@/shared/domain-event-dispatcher";
import { FakeCrawlJobRepository, FakeCrawlQueuePort, SilentLogger } from "./fakes";

function config(overrides: Partial<{ maxPages: number }> = {}): CrawlConfig {
  const result = CrawlConfig.create(overrides);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("FinalizeCrawlJobIfDoneUseCase", () => {
  it("does nothing when the crawl job cannot be found", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const queue = new FakeCrawlQueuePort();
    const useCase = new FinalizeCrawlJobIfDoneUseCase({ crawlJobRepository, queue, logger: new SilentLogger() });

    await useCase.execute("missing-job");

    expect(crawlJobRepository.saved).toHaveLength(0);
  });

  it("does nothing when the crawl job is not RUNNING", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = CrawlJob.create("project-1", config()); // PENDING
    crawlJobRepository.seed(job);
    const queue = new FakeCrawlQueuePort();
    const useCase = new FinalizeCrawlJobIfDoneUseCase({ crawlJobRepository, queue, logger: new SilentLogger() });

    await useCase.execute(job.id);

    expect(crawlJobRepository.saved).toHaveLength(0);
  });

  it("leaves a RUNNING job alone while tasks are still pending and under the page limit", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = CrawlJob.create("project-1", config());
    job.start();
    crawlJobRepository.seed(job);
    const queue = new FakeCrawlQueuePort();
    queue.pendingOverride = 3;
    const useCase = new FinalizeCrawlJobIfDoneUseCase({ crawlJobRepository, queue, logger: new SilentLogger() });

    await useCase.execute(job.id);

    expect(job.status).toBe("RUNNING");
    expect(crawlJobRepository.saved).toHaveLength(0);
  });

  it("completes the job once there are no pending tasks left", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = CrawlJob.create("project-1", config());
    job.start();
    crawlJobRepository.seed(job);
    const queue = new FakeCrawlQueuePort();
    queue.pendingOverride = 0;
    const useCase = new FinalizeCrawlJobIfDoneUseCase({ crawlJobRepository, queue, logger: new SilentLogger() });

    await useCase.execute(job.id);

    expect(job.status).toBe("COMPLETED");
    expect(crawlJobRepository.saved).toHaveLength(1);
  });

  it("completes the job once the page limit is reached, even if tasks are still pending", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = CrawlJob.reconstitute({
      id: "job-1",
      projectId: "project-1",
      config: config({ maxPages: 5 }),
      status: "RUNNING",
      pageCount: 5,
      startedAt: new Date(),
      finishedAt: null,
      error: null,
    });
    crawlJobRepository.seed(job);
    const queue = new FakeCrawlQueuePort();
    queue.pendingOverride = 10;
    const useCase = new FinalizeCrawlJobIfDoneUseCase({ crawlJobRepository, queue, logger: new SilentLogger() });

    await useCase.execute(job.id);

    expect(job.status).toBe("COMPLETED");
  });

  it("dispatches CrawlJobCompleted once the job completes, when a dispatcher is provided", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = CrawlJob.create("project-1", config());
    job.start();
    crawlJobRepository.seed(job);
    const queue = new FakeCrawlQueuePort();
    queue.pendingOverride = 0;
    const eventDispatcher = new DomainEventDispatcher();
    const received: CrawlJobCompleted[] = [];
    eventDispatcher.on(CrawlJobCompleted, async (event) => {
      received.push(event);
    });
    const useCase = new FinalizeCrawlJobIfDoneUseCase({
      crawlJobRepository,
      queue,
      logger: new SilentLogger(),
      eventDispatcher,
    });

    await useCase.execute(job.id);

    expect(received).toHaveLength(1);
    expect(received[0]?.crawlJobId).toBe(job.id);
  });

  it("does not dispatch anything when the job does not complete", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const job = CrawlJob.create("project-1", config());
    job.start();
    crawlJobRepository.seed(job);
    const queue = new FakeCrawlQueuePort();
    queue.pendingOverride = 3; // still pending, won't complete
    const eventDispatcher = new DomainEventDispatcher();
    let called = false;
    eventDispatcher.on(CrawlJobCompleted, async () => {
      called = true;
    });
    const useCase = new FinalizeCrawlJobIfDoneUseCase({
      crawlJobRepository,
      queue,
      logger: new SilentLogger(),
      eventDispatcher,
    });

    await useCase.execute(job.id);

    expect(called).toBe(false);
  });
});
