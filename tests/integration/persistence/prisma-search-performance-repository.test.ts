import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaSearchPerformanceRepository } from "@/infrastructure/persistence/prisma/prisma-search-performance-repository";
import { SearchPerformanceSnapshot } from "@/domain/tracking/entities/search-performance-snapshot";

describe("PrismaSearchPerformanceRepository", () => {
  const repository = new PrismaSearchPerformanceRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Search Performance Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("saves and retrieves snapshots ordered most-recent-first", async () => {
    await repository.saveMany([
      SearchPerformanceSnapshot.create(projectId, new Date("2026-06-01"), 10, 100, 0.1, 5.0),
      SearchPerformanceSnapshot.create(projectId, new Date("2026-06-02"), 20, 200, 0.1, 4.5),
    ]);

    const found = await repository.findByProjectId(projectId);
    expect(found).toHaveLength(2);
    expect(found[0].date.toISOString().slice(0, 10)).toBe("2026-06-02");
    expect(found[1].date.toISOString().slice(0, 10)).toBe("2026-06-01");
  });

  it("overwrites the row for an already-stored date rather than duplicating it", async () => {
    await repository.saveMany([SearchPerformanceSnapshot.create(projectId, new Date("2026-06-03"), 1, 10, 0.1, 9.9)]);
    await repository.saveMany([SearchPerformanceSnapshot.create(projectId, new Date("2026-06-03"), 99, 999, 0.2, 1.1)]);

    const rows = await prisma.searchPerformanceSnapshot.findMany({
      where: { projectId, date: new Date("2026-06-03") },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].clicks).toBe(99);
  });

  it("findLatestFetchedAt returns the most recent fetchedAt, null when nothing stored", async () => {
    const found = await repository.findLatestFetchedAt(crypto.randomUUID());
    expect(found).toBeNull();

    await repository.saveMany([SearchPerformanceSnapshot.create(projectId, new Date("2026-06-04"), 1, 1, 0.1, 1)]);
    const latest = await repository.findLatestFetchedAt(projectId);
    expect(latest).not.toBeNull();
  });
});
