import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaFixCandidateRepository } from "@/infrastructure/persistence/prisma/prisma-fix-candidate-repository";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { PrismaPageRepository } from "@/infrastructure/persistence/prisma/prisma-page-repository";
import { PrismaAuditRunRepository } from "@/infrastructure/persistence/prisma/prisma-audit-run-repository";
import { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { CrawlConfig } from "@/domain/crawling/value-objects/crawl-config";
import { AuditRun } from "@/domain/auditing/entities/audit-run";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";
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

describe("PrismaFixCandidateRepository", () => {
  const repository = new PrismaFixCandidateRepository(prisma);
  const crawlJobRepository = new PrismaCrawlJobRepository(prisma);
  const pageRepository = new PrismaPageRepository(prisma);
  const auditRunRepository = new PrismaAuditRunRepository(prisma);
  let projectId: string;
  let crawlJobId: string;
  let pageId: string;
  let auditIssueId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Fix Candidates Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;

    const crawlJob = CrawlJob.create(project.id, config());
    await crawlJobRepository.save(crawlJob);
    crawlJobId = crawlJob.id;

    const page = Page.create(crawlJobId, url("https://example.com/"), { statusCode: 200 });
    await pageRepository.save(project.id, page);
    pageId = page.id;

    const auditRun = AuditRun.create(project.id, crawlJobId);
    const issue = AuditIssue.create(auditRun.id, pageId, {
      ruleId: "missing-title",
      category: "technical",
      severity: "CRITICAL",
      message: "no title",
    });
    auditRun.addIssue(issue);
    auditRun.finish(1);
    await auditRunRepository.save(auditRun);
    auditIssueId = issue.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("persists and retrieves fix candidates for a crawl job", async () => {
    const candidate = FixCandidate.createRuleBased(auditIssueId, pageId, "TITLE", "A Generated Title");

    await repository.saveMany([candidate]);
    const found = await repository.findAllByCrawlJobId(crawlJobId);

    expect(found).toHaveLength(1);
    expect(found[0]?.id).toBe(candidate.id);
    expect(found[0]?.content).toBe("A Generated Title");
    expect(found[0]?.source).toBe("rule_based");
    expect(found[0]?.status).toBe("DRAFT");
  });

  it("returns an empty array for a crawl job with no fix candidates", async () => {
    const found = await repository.findAllByCrawlJobId(crypto.randomUUID());
    expect(found).toEqual([]);
  });

  it("is a no-op when saving an empty array", async () => {
    await expect(repository.saveMany([])).resolves.toBeUndefined();
  });
});
