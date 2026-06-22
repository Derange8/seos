import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaAnalyticsSnapshotRepository } from "@/infrastructure/persistence/prisma/prisma-analytics-snapshot-repository";
import { AnalyticsSnapshot } from "@/domain/tracking/entities/analytics-snapshot";

describe("PrismaAnalyticsSnapshotRepository", () => {
  const repository = new PrismaAnalyticsSnapshotRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Analytics Snapshot Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("saves and retrieves snapshots ordered most-recent-first", async () => {
    await repository.saveMany([
      AnalyticsSnapshot.create(projectId, new Date("2026-06-01"), 50, 5),
      AnalyticsSnapshot.create(projectId, new Date("2026-06-02"), 80, 8),
    ]);

    const found = await repository.findByProjectId(projectId);
    expect(found).toHaveLength(2);
    expect(found[0].date.toISOString().slice(0, 10)).toBe("2026-06-02");
    expect(found[0].organicSessions).toBe(80);
  });

  it("overwrites the row for an already-stored date rather than duplicating it", async () => {
    await repository.saveMany([AnalyticsSnapshot.create(projectId, new Date("2026-06-03"), 1, 0)]);
    await repository.saveMany([AnalyticsSnapshot.create(projectId, new Date("2026-06-03"), 99, 9)]);

    const rows = await prisma.analyticsSnapshot.findMany({ where: { projectId, date: new Date("2026-06-03") } });
    expect(rows).toHaveLength(1);
    expect(rows[0].organicSessions).toBe(99);
  });
});
