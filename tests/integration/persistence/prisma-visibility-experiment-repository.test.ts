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
    // Web-grounded baseline, not yet cited — the citation axis round-trips too.
    const experiment = VisibilityExperiment.start(projectId, "best market", "OPEN", new Date("2026-07-01"), true, false);
    await repository.save(experiment);

    expect(await repository.findByProjectId(projectId)).toHaveLength(1);
    expect(await repository.findOpenByProjectId(projectId)).toHaveLength(1);
    const open = await repository.findOpenByProjectAndQuery(projectId, "best market");
    expect(open?.baselineSlot).toBe("OPEN");
    expect(open?.baselineGrounded).toBe(true);
    expect(open?.baselineCited).toBe(false);
  });

  it("reflects a resolve — a citation gain with a flat slot round-trips as IMPROVED", async () => {
    const found = await repository.findOpenByProjectAndQuery(projectId, "best market");
    // Slot stays OPEN, but the domain is now cited on a web-grounded re-measure.
    found?.resolve("OPEN", new Date("2026-07-10"), true, true);
    await repository.save(found!);

    expect(await repository.findOpenByProjectId(projectId)).toHaveLength(0);
    const [reloaded] = await repository.findByProjectId(projectId);
    expect(reloaded.status).toBe("RESOLVED");
    expect(reloaded.outcomeSlot).toBe("OPEN");
    expect(reloaded.outcomeCited).toBe(true);
    expect(reloaded.citationMovement).toBe("GAINED");
    expect(reloaded.outcome).toBe("IMPROVED");
  });
});
