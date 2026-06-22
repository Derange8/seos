import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaKeywordOpportunityRepository } from "@/infrastructure/persistence/prisma/prisma-keyword-opportunity-repository";
import { KeywordOpportunity } from "@/domain/tracking/entities/keyword-opportunity";

describe("PrismaKeywordOpportunityRepository", () => {
  const repository = new PrismaKeywordOpportunityRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Keyword Opportunity Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("saves and retrieves opportunities ordered most-impressions-first", async () => {
    await repository.saveMany([
      KeywordOpportunity.create(projectId, "https://example.com/a", "query a", 1, 100, 0.05, 12),
      KeywordOpportunity.create(projectId, "https://example.com/b", "query b", 2, 500, 0.05, 8),
    ]);

    const found = await repository.findByProjectId(projectId);
    expect(found).toHaveLength(2);
    expect(found[0].query).toBe("query b");
    expect(found[1].query).toBe("query a");
  });

  it("overwrites the row for an already-stored (pageUrl, query) pair rather than duplicating it", async () => {
    await repository.saveMany([
      KeywordOpportunity.create(projectId, "https://example.com/c", "query c", 1, 10, 0.1, 15),
    ]);
    await repository.saveMany([
      KeywordOpportunity.create(projectId, "https://example.com/c", "query c", 99, 999, 0.2, 9),
    ]);

    const rows = await prisma.keywordOpportunity.findMany({
      where: { projectId, pageUrl: "https://example.com/c", query: "query c" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].clicks).toBe(99);
  });

  it("findById returns the opportunity, null when not found", async () => {
    await repository.saveMany([KeywordOpportunity.create(projectId, "https://example.com/d", "query d", 1, 10, 0.1, 15)]);
    const [saved] = await repository.findByProjectId(projectId).then((rows) => rows.filter((r) => r.query === "query d"));

    const found = await repository.findById(saved.id);
    expect(found?.query).toBe("query d");

    const notFound = await repository.findById(crypto.randomUUID());
    expect(notFound).toBeNull();
  });
});
