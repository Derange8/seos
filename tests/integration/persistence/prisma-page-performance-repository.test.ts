import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaPagePerformanceRepository } from "@/infrastructure/persistence/prisma/prisma-page-performance-repository";
import { PagePerformance } from "@/domain/tracking/entities/page-performance";

describe("PrismaPagePerformanceRepository", () => {
  const repository = new PrismaPagePerformanceRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Page Performance Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("saves and retrieves page performance rows for a project", async () => {
    await repository.saveMany([
      PagePerformance.create(projectId, "https://example.com/a", 10, 100, 0.1, 5.0),
      PagePerformance.create(projectId, "https://example.com/b", 20, 200, 0.1, 4.5),
    ]);

    const found = await repository.findByProjectId(projectId);
    expect(found).toHaveLength(2);
    expect(found.map((row) => row.pageUrl).sort()).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("overwrites the row for an already-stored (projectId, pageUrl) pair rather than duplicating it", async () => {
    await repository.saveMany([PagePerformance.create(projectId, "https://example.com/c", 1, 10, 0.1, 9.9)]);
    await repository.saveMany([PagePerformance.create(projectId, "https://example.com/c", 99, 999, 0.2, 1.1)]);

    const rows = await prisma.pagePerformance.findMany({
      where: { projectId, pageUrl: "https://example.com/c" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].clicks).toBe(99);
  });

  it("findByProjectId returns an empty array when nothing is stored", async () => {
    const found = await repository.findByProjectId(crypto.randomUUID());
    expect(found).toEqual([]);
  });
});
