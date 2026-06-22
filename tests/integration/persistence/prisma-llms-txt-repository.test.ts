import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaLlmsTxtRepository } from "@/infrastructure/persistence/prisma/prisma-llms-txt-repository";
import { LlmsTxtFile } from "@/domain/llms-txt/entities/llms-txt-file";

describe("PrismaLlmsTxtRepository", () => {
  const repository = new PrismaLlmsTxtRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Llms Txt Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("round-trips an llms.txt file", async () => {
    const llmsTxtFile = LlmsTxtFile.create(projectId, "# Acme Inc\n\n> Summary.\n\n## Pages\n", 0);

    await repository.save(llmsTxtFile);
    const found = await repository.findLatestByProjectId(projectId);

    expect(found?.id).toBe(llmsTxtFile.id);
    expect(found?.content).toBe("# Acme Inc\n\n> Summary.\n\n## Pages\n");
    expect(found?.pageCount).toBe(0);
  });

  it("findLatestByProjectId returns the most recently generated file", async () => {
    const earlier = LlmsTxtFile.create(projectId, "# earlier", 1);
    await repository.save(earlier);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const later = LlmsTxtFile.create(projectId, "# later", 2);
    await repository.save(later);

    const found = await repository.findLatestByProjectId(projectId);
    expect(found?.id).toBe(later.id);
  });

  it("returns null when no llms.txt exists for a project", async () => {
    const found = await repository.findLatestByProjectId(crypto.randomUUID());
    expect(found).toBeNull();
  });
});
