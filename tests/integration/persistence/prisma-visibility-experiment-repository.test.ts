import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaVisibilityExperimentRepository } from "@/infrastructure/persistence/prisma/prisma-visibility-experiment-repository";
import { VisibilityExperiment } from "@/domain/ai-visibility/entities/visibility-experiment";

describe("PrismaVisibilityExperimentRepository", () => {
  const repository = new PrismaVisibilityExperimentRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Experiment Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("saves an open experiment and finds it by project and open-by-query", async () => {
    const experiment = VisibilityExperiment.start(projectId, "best market", "CONTESTED", new Date("2026-07-01"));
    await repository.save(experiment);

    expect(await repository.findByProjectId(projectId)).toHaveLength(1);
    expect(await repository.findOpenByProjectId(projectId)).toHaveLength(1);
    const open = await repository.findOpenByProjectAndQuery(projectId, "best market");
    expect(open?.baselineSlot).toBe("CONTESTED");
  });

  it("reflects a resolve — status, outcome slot, and computed outcome round-trip", async () => {
    const found = await repository.findOpenByProjectAndQuery(projectId, "best market");
    found?.resolve("MENTIONED", new Date("2026-07-10"));
    await repository.save(found!);

    expect(await repository.findOpenByProjectId(projectId)).toHaveLength(0);
    const [reloaded] = await repository.findByProjectId(projectId);
    expect(reloaded.status).toBe("RESOLVED");
    expect(reloaded.outcomeSlot).toBe("MENTIONED");
    expect(reloaded.outcome).toBe("IMPROVED");
  });
});
