import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaKeywordCannibalizationRepository } from "@/infrastructure/persistence/prisma/prisma-keyword-cannibalization-repository";
import { KeywordCannibalizationIssue } from "@/domain/tracking/entities/keyword-cannibalization";

describe("PrismaKeywordCannibalizationRepository", () => {
  const repository = new PrismaKeywordCannibalizationRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Cannibalization Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("saves and retrieves issues with their competing pages intact", async () => {
    await repository.replaceForProject(projectId, [
      KeywordCannibalizationIssue.create(projectId, "widgets", [
        { pageUrl: "https://example.com/a", clicks: 5, impressions: 100, ctr: 0.05, position: 8 },
        { pageUrl: "https://example.com/b", clicks: 2, impressions: 50, ctr: 0.04, position: 12 },
      ]),
    ]);

    const found = await repository.findByProjectId(projectId);
    expect(found).toHaveLength(1);
    expect(found[0].query).toBe("widgets");
    expect(found[0].pages).toHaveLength(2);
    expect(found[0].pages[0].pageUrl).toBe("https://example.com/a");
  });

  it("replaces the whole set on the next call rather than upserting — a resolved query disappears", async () => {
    await repository.replaceForProject(projectId, [
      KeywordCannibalizationIssue.create(projectId, "widgets", [
        { pageUrl: "https://example.com/a", clicks: 5, impressions: 100, ctr: 0.05, position: 8 },
        { pageUrl: "https://example.com/b", clicks: 2, impressions: 50, ctr: 0.04, position: 12 },
      ]),
      KeywordCannibalizationIssue.create(projectId, "gadgets", [
        { pageUrl: "https://example.com/c", clicks: 1, impressions: 80, ctr: 0.01, position: 5 },
        { pageUrl: "https://example.com/d", clicks: 1, impressions: 60, ctr: 0.01, position: 9 },
      ]),
    ]);

    // "widgets" is no longer cannibalized this time — only "gadgets" comes back.
    await repository.replaceForProject(projectId, [
      KeywordCannibalizationIssue.create(projectId, "gadgets", [
        { pageUrl: "https://example.com/c", clicks: 1, impressions: 80, ctr: 0.01, position: 5 },
        { pageUrl: "https://example.com/d", clicks: 1, impressions: 60, ctr: 0.01, position: 9 },
      ]),
    ]);

    const found = await repository.findByProjectId(projectId);
    expect(found.map((issue) => issue.query)).toEqual(["gadgets"]);
  });

  it("clears all issues when replaced with an empty list", async () => {
    await repository.replaceForProject(projectId, [
      KeywordCannibalizationIssue.create(projectId, "widgets", [
        { pageUrl: "https://example.com/a", clicks: 5, impressions: 100, ctr: 0.05, position: 8 },
        { pageUrl: "https://example.com/b", clicks: 2, impressions: 50, ctr: 0.04, position: 12 },
      ]),
    ]);

    await repository.replaceForProject(projectId, []);

    const found = await repository.findByProjectId(projectId);
    expect(found).toHaveLength(0);
  });
});
