import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaRobotsRepository } from "@/infrastructure/persistence/prisma/prisma-robots-repository";
import { RobotsFile } from "@/domain/robots/entities/robots-file";

describe("PrismaRobotsRepository", () => {
  const repository = new PrismaRobotsRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Robots Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("round-trips a robots file", async () => {
    const robotsFile = RobotsFile.create(projectId, "User-agent: *\nAllow: /\n");

    await repository.save(robotsFile);
    const found = await repository.findLatestByProjectId(projectId);

    expect(found?.id).toBe(robotsFile.id);
    expect(found?.content).toBe("User-agent: *\nAllow: /\n");
  });

  it("returns null when no robots file exists for a project", async () => {
    const found = await repository.findLatestByProjectId(crypto.randomUUID());
    expect(found).toBeNull();
  });
});
