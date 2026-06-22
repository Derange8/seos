import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaAuditRunRepository } from "@/infrastructure/persistence/prisma/prisma-audit-run-repository";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { PrismaPageRepository } from "@/infrastructure/persistence/prisma/prisma-page-repository";
import { AuditRun } from "@/domain/auditing/entities/audit-run";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";

function config(): CrawlConfig {
  const result = CrawlConfig.create({});
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("PrismaAuditRunRepository", () => {
  const repository = new PrismaAuditRunRepository(prisma);
  const crawlJobRepository = new PrismaCrawlJobRepository(prisma);
  const pageRepository = new PrismaPageRepository(prisma);
  let projectId: string;
  let crawlJobId: string;
  let pageId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Audit Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;

    const crawlJob = CrawlJob.create(projectId, config());
    await crawlJobRepository.save(crawlJob);
    crawlJobId = crawlJob.id;

    const page = Page.create(crawlJobId, url("https://example.com/"), { title: null, statusCode: 200 });
    await pageRepository.save(projectId, page);
    pageId = page.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("round-trips an audit run with its issues", async () => {
    const auditRun = AuditRun.create(projectId, crawlJobId);
    auditRun.addIssue(
      AuditIssue.create(auditRun.id, pageId, {
        ruleId: "missing-title",
        category: "technical",
        severity: "CRITICAL",
        message: "no title",
      })
    );
    auditRun.finish(1);

    await repository.save(auditRun);
    const found = await repository.findById(auditRun.id);

    expect(found?.id).toBe(auditRun.id);
    expect(found?.projectId).toBe(projectId);
    expect(found?.crawlJobId).toBe(crawlJobId);
    expect(found?.overallScore).toBe(90);
    expect(found?.isFinished).toBe(true);
    expect(found?.issues).toHaveLength(1);
    expect(found?.issues[0]?.ruleId).toBe("missing-title");
    expect(found?.issues[0]?.severity).toBe("CRITICAL");
    expect(found?.issues[0]?.pageId).toBe(pageId);
  });

  it("replaces issues wholesale on a second save", async () => {
    const auditRun = AuditRun.create(projectId, crawlJobId);
    auditRun.addIssue(
      AuditIssue.create(auditRun.id, pageId, {
        ruleId: "missing-h1",
        category: "content",
        severity: "WARNING",
        message: "no h1",
      })
    );
    await repository.save(auditRun);

    // Reload, add a second issue on top of the one already persisted, and
    // save again — both should survive (deleteMany+createMany replaces with
    // whatever is in memory at save time, it doesn't wipe and only re-add
    // what changed).
    const reloaded = await repository.findById(auditRun.id);
    reloaded?.addIssue(
      AuditIssue.create(auditRun.id, pageId, {
        ruleId: "missing-canonical",
        category: "technical",
        severity: "INFO",
        message: "no canonical",
      })
    );
    if (reloaded) await repository.save(reloaded);

    const found = await repository.findById(auditRun.id);
    expect(found?.issues.map((i) => i.ruleId).sort()).toEqual(["missing-canonical", "missing-h1"]);
  });

  it("returns null for an unknown id", async () => {
    const found = await repository.findById(crypto.randomUUID());
    expect(found).toBeNull();
  });

  it("findByCrawlJobId returns the most recent audit run for that crawl job", async () => {
    // A dedicated crawl job, isolated from the other tests in this file —
    // they share the outer `crawlJobId` and create their own AuditRuns with
    // a real "now" startedAt, which would otherwise outrank the explicit
    // 2026-01-* timestamps used below to make the ordering deterministic.
    const isolatedJob = CrawlJob.create(projectId, config());
    await crawlJobRepository.save(isolatedJob);
    const isolatedCrawlJobId = isolatedJob.id;

    const earlier = AuditRun.reconstitute({
      id: crypto.randomUUID(),
      projectId,
      crawlJobId: isolatedCrawlJobId,
      issues: [],
      overallScore: 100,
      startedAt: new Date("2026-01-01T00:00:00Z"),
      finishedAt: new Date("2026-01-01T00:00:01Z"),
    });
    await repository.save(earlier);

    const later = AuditRun.reconstitute({
      id: crypto.randomUUID(),
      projectId,
      crawlJobId: isolatedCrawlJobId,
      issues: [],
      overallScore: 96,
      startedAt: new Date("2026-01-02T00:00:00Z"),
      finishedAt: new Date("2026-01-02T00:00:01Z"),
    });
    later.addIssue(
      AuditIssue.create(later.id, pageId, {
        ruleId: "missing-h1",
        category: "content",
        severity: "WARNING",
        message: "no h1",
      })
    );
    await repository.save(later);

    const found = await repository.findByCrawlJobId(isolatedCrawlJobId);
    expect(found?.id).toBe(later.id);
  });

  it("findByCrawlJobId returns null when no audit run exists for that crawl job", async () => {
    const found = await repository.findByCrawlJobId(crypto.randomUUID());
    expect(found).toBeNull();
  });

  it("findRecentByProjectId returns finished runs across different crawl jobs, newest first", async () => {
    const project = await prisma.project.create({
      data: {
        name: "Delta Test Project",
        domain: `itest-${crypto.randomUUID()}.example.com`,
      },
    });
    const jobA = CrawlJob.create(project.id, config());
    const jobB = CrawlJob.create(project.id, config());
    await crawlJobRepository.save(jobA);
    await crawlJobRepository.save(jobB);

    const unfinished = AuditRun.create(project.id, jobA.id);

    const older = AuditRun.reconstitute({
      id: crypto.randomUUID(),
      projectId: project.id,
      crawlJobId: jobA.id,
      issues: [],
      overallScore: 80,
      startedAt: new Date("2026-01-01T00:00:00Z"),
      finishedAt: new Date("2026-01-01T00:00:01Z"),
    });
    const newer = AuditRun.reconstitute({
      id: crypto.randomUUID(),
      projectId: project.id,
      crawlJobId: jobB.id,
      issues: [],
      overallScore: 96,
      startedAt: new Date("2026-01-02T00:00:00Z"),
      finishedAt: new Date("2026-01-02T00:00:01Z"),
    });

    await repository.save(unfinished);
    await repository.save(older);
    await repository.save(newer);

    const recent = await repository.findRecentByProjectId(project.id, 2);

    expect(recent.map((run) => run.id)).toEqual([newer.id, older.id]);

    await prisma.project.delete({ where: { id: project.id } });
  });
});
