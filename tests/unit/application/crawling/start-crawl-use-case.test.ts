import { describe, expect, it } from "vitest";
import { StartCrawlUseCase } from "@/application/crawling/use-cases/start-crawl-use-case";
import { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";
import { Url } from "@/domain/crawling/value-objects/url";
import { Project } from "@/domain/projects/entities/project";
import { DomainName } from "@/domain/projects/value-objects/domain-name";
import { FakeCrawlJobRepository, FakeCrawlQueuePort } from "./fakes";
import { FakeProjectRepository } from "../projects/fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function domain(input: string): DomainName {
  const result = DomainName.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function verifiedProject(): Project {
  const project = Project.create("Site", domain("example.com"));
  project.markVerified();
  return project;
}

describe("StartCrawlUseCase", () => {
  it("creates, starts, and persists a crawl job, then enqueues the seed task", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const projectRepository = new FakeProjectRepository();
    const project = verifiedProject();
    projectRepository.seed(project);
    const queue = new FakeCrawlQueuePort();
    const useCase = new StartCrawlUseCase({ crawlJobRepository, projectRepository, queue });

    const result = await useCase.execute(project.id, url("https://example.com/"), { maxPages: 50 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.status).toBe("RUNNING");
    expect(result.value.config.maxPages).toBe(50);
    expect(crawlJobRepository.saved).toHaveLength(1);
    expect(queue.enqueued).toHaveLength(1);
    expect(queue.enqueued[0]?.crawlJobId).toBe(result.value.id);
    expect(queue.enqueued[0]?.url.href).toBe("https://example.com/");
    expect(queue.enqueued[0]?.depth).toBe(0);
    expect(queue.enqueued[0]?.discoveredFrom).toBeNull();
  });

  it("returns an error and persists nothing for an invalid config", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const projectRepository = new FakeProjectRepository();
    const project = verifiedProject();
    projectRepository.seed(project);
    const queue = new FakeCrawlQueuePort();
    const useCase = new StartCrawlUseCase({ crawlJobRepository, projectRepository, queue });

    const result = await useCase.execute(project.id, url("https://example.com/"), { maxPages: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_CRAWL_CONFIG");
    }
    expect(crawlJobRepository.saved).toHaveLength(0);
    expect(queue.enqueued).toHaveLength(0);
  });

  it("returns an error when the project does not exist", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const projectRepository = new FakeProjectRepository();
    const queue = new FakeCrawlQueuePort();
    const useCase = new StartCrawlUseCase({ crawlJobRepository, projectRepository, queue });

    const result = await useCase.execute("missing-project", url("https://example.com/"));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PROJECT_NOT_FOUND");
    expect(queue.enqueued).toHaveLength(0);
  });

  it("allows starting a crawl for an unverified domain — crawling is read-only and doesn't need proof of ownership", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const projectRepository = new FakeProjectRepository();
    const project = Project.create("Site", domain("example.com")); // not verified
    projectRepository.seed(project);
    const queue = new FakeCrawlQueuePort();
    const useCase = new StartCrawlUseCase({ crawlJobRepository, projectRepository, queue });

    const result = await useCase.execute(project.id, url("https://example.com/"));

    expect(result.ok).toBe(true);
    expect(crawlJobRepository.saved).toHaveLength(1);
    expect(queue.enqueued).toHaveLength(1);
  });

  it("refuses to start a second crawl while one is already PENDING/RUNNING for the project", async () => {
    const crawlJobRepository = new FakeCrawlJobRepository();
    const projectRepository = new FakeProjectRepository();
    const project = verifiedProject();
    projectRepository.seed(project);

    const configResult = CrawlConfig.create();
    if (!configResult.ok) throw new Error("expected ok result");
    const alreadyRunning = CrawlJob.create(project.id, configResult.value);
    alreadyRunning.start();
    crawlJobRepository.seed(alreadyRunning);

    const queue = new FakeCrawlQueuePort();
    const useCase = new StartCrawlUseCase({ crawlJobRepository, projectRepository, queue });

    const result = await useCase.execute(project.id, url("https://example.com/"));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CRAWL_ALREADY_IN_PROGRESS");
    expect(queue.enqueued).toHaveLength(0);
  });
});
