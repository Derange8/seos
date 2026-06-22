import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaSeoScoreRepository } from "@/infrastructure/persistence/prisma/prisma-seo-score-repository";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { PrismaAuditRunRepository } from "@/infrastructure/persistence/prisma/prisma-audit-run-repository";
import { SeoScore } from "@/domain/scoring/entities/seo-score";
import { AuditRun } from "@/domain/auditing/entities/audit-run";
import { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";

function config(): CrawlConfig {
  const result = CrawlConfig.create({});
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("PrismaSeoScoreRepository", () => {
  const repository = new PrismaSeoScoreRepository(prisma);
  const crawlJobRepository = new PrismaCrawlJobRepository(prisma);
  const auditRunRepository = new PrismaAuditRunRepository(prisma);
  let projectId: string;
  let crawlJobId: string;
  let auditRunId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Scoring Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;

    const crawlJob = CrawlJob.create(project.id, config());
    await crawlJobRepository.save(crawlJob);
    crawlJobId = crawlJob.id;

    const auditRun = AuditRun.create(project.id, crawlJobId);
    auditRun.finish(0);
    await auditRunRepository.save(auditRun);
    auditRunId = auditRun.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("persists and retrieves both site-level and page-level scores for a crawl job", async () => {
    const siteLevel = SeoScore.create(auditRunId, null, "technical", 95);
    const pageLevel = SeoScore.create(auditRunId, "page-1", "content", 80);

    await repository.saveMany([siteLevel, pageLevel]);
    const found = await repository.findByCrawlJobId(crawlJobId);

    expect(found).toHaveLength(2);
    const foundSiteLevel = found.find((s) => s.isSiteLevel);
    const foundPageLevel = found.find((s) => !s.isSiteLevel);
    expect(foundSiteLevel?.score).toBe(95);
    expect(foundPageLevel?.pageId).toBe("page-1");
    expect(foundPageLevel?.score).toBe(80);
  });

  it("returns an empty array for a crawl job with no scores", async () => {
    const found = await repository.findByCrawlJobId(crypto.randomUUID());
    expect(found).toEqual([]);
  });

  it("is a no-op when saving an empty array", async () => {
    await expect(repository.saveMany([])).resolves.toBeUndefined();
  });
});
