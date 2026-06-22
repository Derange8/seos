import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";

function config(maxPages = 25): CrawlConfig {
  const result = CrawlConfig.create({ maxPages });
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("PrismaCrawlJobRepository", () => {
  const repository = new PrismaCrawlJobRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: {
        name: "Integration Test Project",
        domain: `itest-${crypto.randomUUID()}.example.com`,
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    // Project/CrawlJob/Page/Link all cascade-delete from Project.
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("round-trips a freshly created crawl job", async () => {
    const job = CrawlJob.create(projectId, config(25));

    await repository.save(job);
    const found = await repository.findById(job.id);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(job.id);
    expect(found?.projectId).toBe(projectId);
    expect(found?.status).toBe("PENDING");
    expect(found?.pageCount).toBe(0);
    expect(found?.config.maxPages).toBe(25);
  });

  it("persists state transitions on subsequent saves", async () => {
    const job = CrawlJob.create(projectId, config());
    await repository.save(job);

    job.start();
    await repository.save(job);

    const runningJob = await repository.findById(job.id);
    expect(runningJob?.status).toBe("RUNNING");
    expect(runningJob?.startedAt).toBeInstanceOf(Date);

    runningJob?.complete();
    if (runningJob) await repository.save(runningJob);

    const completedJob = await repository.findById(job.id);
    expect(completedJob?.status).toBe("COMPLETED");
    expect(completedJob?.finishedAt).toBeInstanceOf(Date);
  });

  it("returns null for an unknown id", async () => {
    const found = await repository.findById(crypto.randomUUID());
    expect(found).toBeNull();
  });

  it("incrementPageCount is atomic under concurrent callers", async () => {
    const job = CrawlJob.create(projectId, config());
    await repository.save(job);

    // Regression test: process-page-task-use-case used to persist pageCount
    // via a load-mutate-save(crawlJob) round trip, which lost increments
    // when multiple workers finished pages for the same job at once.
    await Promise.all(Array.from({ length: 10 }, () => repository.incrementPageCount(job.id)));

    const found = await repository.findById(job.id);
    expect(found?.pageCount).toBe(10);
  });

  it("findActiveByProjectId finds a RUNNING job but not a COMPLETED one", async () => {
    // A dedicated project, isolated from the other tests in this file —
    // they share the outer `projectId` and leave their own PENDING/RUNNING
    // jobs behind, which would otherwise be picked up here too.
    const isolatedProject = await prisma.project.create({
      data: { name: "Active Job Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });

    const finished = CrawlJob.create(isolatedProject.id, config());
    finished.start();
    finished.complete();
    await repository.save(finished);

    const noneYet = await repository.findActiveByProjectId(isolatedProject.id);
    expect(noneYet).toBeNull();

    const running = CrawlJob.create(isolatedProject.id, config());
    running.start();
    await repository.save(running);

    const active = await repository.findActiveByProjectId(isolatedProject.id);
    expect(active?.id).toBe(running.id);
  });
});
