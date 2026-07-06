import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaAiVisibilityRunRepository } from "@/infrastructure/persistence/prisma/prisma-ai-visibility-run-repository";
import { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";

describe("PrismaAiVisibilityRunRepository", () => {
  const repository = new PrismaAiVisibilityRunRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "AI Visibility Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("returns null when a project has no probe run", async () => {
    expect(await repository.findLatestByProjectId(crypto.randomUUID())).toBeNull();
  });

  it("saves a run and reads its outcomes back intact", async () => {
    const run = AiVisibilityProbeRun.reconstitute({
      id: crypto.randomUUID(),
      projectId,
      samplesPerQuery: 3,
      groundingMode: "parametric",
      runAt: new Date("2026-07-01"),
      outcomes: [
        { query: "q1", slots: ["OPEN", "CONTESTED", "OPEN"], competitorsMentioned: ["Polymarket"], citedSamples: 0, citations: [] },
        { query: "q2", slots: ["MENTIONED"], competitorsMentioned: [], citedSamples: 0, citations: [] },
      ],
    });

    await repository.save(run);
    const found = await repository.findLatestByProjectId(projectId);

    expect(found).not.toBeNull();
    expect(found?.samplesPerQuery).toBe(3);
    expect(found?.outcomes).toHaveLength(2);
    const q1 = found?.outcomes.find((o) => o.query === "q1");
    expect(q1?.slots).toEqual(["OPEN", "CONTESTED", "OPEN"]);
    expect(q1?.competitorsMentioned).toEqual(["Polymarket"]);
  });

  it("findLatest returns the most recent run by runAt", async () => {
    await repository.save(
      AiVisibilityProbeRun.reconstitute({
        id: crypto.randomUUID(),
        projectId,
        samplesPerQuery: 1,
        groundingMode: "parametric",
        runAt: new Date("2026-06-01"),
        outcomes: [{ query: "old", slots: ["OPEN"], competitorsMentioned: [], citedSamples: 0, citations: [] }],
      })
    );
    await repository.save(
      AiVisibilityProbeRun.reconstitute({
        id: crypto.randomUUID(),
        projectId,
        samplesPerQuery: 1,
        groundingMode: "parametric",
        runAt: new Date("2026-07-15"),
        outcomes: [{ query: "new", slots: ["MENTIONED"], competitorsMentioned: [], citedSamples: 0, citations: [] }],
      })
    );

    const found = await repository.findLatestByProjectId(projectId);
    expect(found?.outcomes[0]?.query).toBe("new");
  });

  it("findRecentByProjectId returns most-recent-first, capped at the limit", async () => {
    const recent = await repository.findRecentByProjectId(projectId, 2);
    expect(recent).toHaveLength(2);
    // Newest first: the 2026-07-15 run saved above, then 2026-07-01.
    expect(recent[0].runAt.getTime()).toBeGreaterThan(recent[1].runAt.getTime());
  });
});
