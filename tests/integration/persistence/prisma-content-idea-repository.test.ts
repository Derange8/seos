import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaContentIdeaRepository } from "@/infrastructure/persistence/prisma/prisma-content-idea-repository";
import { ContentIdea } from "@/domain/content-enrichment/entities/content-idea";

describe("PrismaContentIdeaRepository", () => {
  const repository = new PrismaContentIdeaRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Content Idea Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("saves and retrieves ideas for a project", async () => {
    const idea = ContentIdea.create(
      projectId,
      "https://example.com/bromelain-syrup",
      "Bromelain Syrup",
      "What Does Bromelain Do?",
      "/blog/what-does-bromelain-do",
      "Common informational question for this product category."
    );

    await repository.replaceForProject(projectId, [idea]);

    const found = await repository.findByProjectId(projectId);
    expect(found).toHaveLength(1);
    expect(found[0].suggestedSlug).toBe("/blog/what-does-bromelain-do");
    expect(found[0].topic).toBe("Bromelain Syrup");
  });

  it("replaces the project's whole batch on regeneration rather than accumulating", async () => {
    const first = ContentIdea.create(projectId, "https://example.com/a", "A", "Title A", "/blog/a", "rationale a");
    await repository.replaceForProject(projectId, [first]);

    const second = ContentIdea.create(projectId, "https://example.com/b", "B", "Title B", "/blog/b", "rationale b");
    await repository.replaceForProject(projectId, [second]);

    const found = await repository.findByProjectId(projectId);
    expect(found).toHaveLength(1);
    expect(found[0].suggestedSlug).toBe("/blog/b");
  });
});
