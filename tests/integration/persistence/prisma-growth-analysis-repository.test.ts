import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaGrowthAnalysisRepository } from "@/infrastructure/persistence/prisma/prisma-growth-analysis-repository";
import { GrowthAnalysis } from "@/domain/content-enrichment/entities/growth-analysis";

describe("PrismaGrowthAnalysisRepository", () => {
  const repository = new PrismaGrowthAnalysisRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Growth Analysis Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("saves and retrieves a growth analysis for a project", async () => {
    const analysis = GrowthAnalysis.create(
      projectId,
      "Sells anti-aging skincare and wellness syrups.",
      "No FAQ on any product page.",
      [
        {
          title: "What Does Bromelain Do?",
          searchIntent: "Informational",
          whyUsersSearch: "Page asks but never answers.",
          whyRevenue: "Links to the product page.",
          suggestedSlug: "/blog/what-does-bromelain-do",
          pageType: "BLOG_ARTICLE",
          priority: "HIGH",
        },
      ],
      [{ pageUrl: "https://example.com/a", recommendation: "Add FAQ." }],
      ["Reviews page"],
      ["FAQ for bromelain"],
      "Add FAQs first."
    );

    await repository.save(analysis);

    const found = await repository.findByProjectId(projectId);
    expect(found).not.toBeNull();
    expect(found?.businessUnderstanding).toBe("Sells anti-aging skincare and wellness syrups.");
    expect(found?.opportunities).toHaveLength(1);
    expect(found?.opportunities[0]?.suggestedSlug).toBe("/blog/what-does-bromelain-do");
    expect(found?.conversionOpportunities).toEqual([{ pageUrl: "https://example.com/a", recommendation: "Add FAQ." }]);
    expect(found?.missingCompetitorPages).toEqual(["Reviews page"]);
    expect(found?.topPages).toEqual(["FAQ for bromelain"]);
  });

  it("overwrites the project's analysis on regeneration rather than accumulating", async () => {
    const first = GrowthAnalysis.create(projectId, "First.", "Gaps.", [], [], [], [], "Summary one.");
    await repository.save(first);

    const second = GrowthAnalysis.create(projectId, "Second.", "Gaps.", [], [], [], [], "Summary two.");
    await repository.save(second);

    const rows = await prisma.growthAnalysis.findMany({ where: { projectId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.businessUnderstanding).toBe("Second.");
  });

  it("returns null for a project with no growth analysis yet", async () => {
    const project = await prisma.project.create({
      data: { name: "No Analysis Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });

    const found = await repository.findByProjectId(project.id);
    expect(found).toBeNull();

    await prisma.project.delete({ where: { id: project.id } });
  });
});
