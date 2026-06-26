import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaCtrUnderperformerRepository } from "@/infrastructure/persistence/prisma/prisma-ctr-underperformer-repository";
import { CtrUnderperformer } from "@/domain/tracking/entities/ctr-underperformer";

describe("PrismaCtrUnderperformerRepository", () => {
  const repository = new PrismaCtrUnderperformerRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "CTR Underperformer Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("saves and retrieves issues ordered most-impressions-first", async () => {
    await repository.replaceForProject(projectId, [
      CtrUnderperformer.create(projectId, "https://example.com/a", "widgets", 2, 0.05, 0.3, 5, 100),
      CtrUnderperformer.create(projectId, "https://example.com/b", "gadgets", 2, 0.02, 0.3, 10, 500),
    ]);

    const found = await repository.findByProjectId(projectId);
    expect(found).toHaveLength(2);
    expect(found[0].query).toBe("gadgets");
    expect(found[1].query).toBe("widgets");
    expect(found[1].expectedCtr).toBe(0.3);
  });

  it("replaces the whole set on the next call — a resolved query disappears", async () => {
    await repository.replaceForProject(projectId, [
      CtrUnderperformer.create(projectId, "https://example.com/a", "widgets", 2, 0.05, 0.3, 5, 100),
      CtrUnderperformer.create(projectId, "https://example.com/c", "doohickeys", 3, 0.01, 0.2, 1, 100),
    ]);

    await repository.replaceForProject(projectId, [
      CtrUnderperformer.create(projectId, "https://example.com/c", "doohickeys", 3, 0.01, 0.2, 1, 100),
    ]);

    const found = await repository.findByProjectId(projectId);
    expect(found.map((issue) => issue.query)).toEqual(["doohickeys"]);
  });

  it("clears all issues when replaced with an empty list", async () => {
    await repository.replaceForProject(projectId, [
      CtrUnderperformer.create(projectId, "https://example.com/a", "widgets", 2, 0.05, 0.3, 5, 100),
    ]);

    await repository.replaceForProject(projectId, []);

    const found = await repository.findByProjectId(projectId);
    expect(found).toHaveLength(0);
  });
});
