import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaPageContentDraftRepository } from "@/infrastructure/persistence/prisma/prisma-page-content-draft-repository";
import { PageContentDraft } from "@/domain/content-enrichment/entities/page-content-draft";

describe("PrismaPageContentDraftRepository", () => {
  const repository = new PrismaPageContentDraftRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Page Content Draft Test", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("saves and retrieves a draft for a project", async () => {
    const draft = PageContentDraft.create(
      projectId,
      "https://example.com/bromelain",
      "Bromelain Şurubu",
      "Faydaları ve kullanımı.",
      [{ heading: "Nedir", content: "Ananas enzimi." }],
      [{ question: "Nasıl kullanılır?", answer: "Günde bir ölçek." }]
    );

    await repository.save(draft);

    const found = await repository.findByProjectId(projectId);
    expect(found).toHaveLength(1);
    expect(found[0].suggestedTitle).toBe("Bromelain Şurubu");
    expect(found[0].bodySections).toEqual([{ heading: "Nedir", content: "Ananas enzimi." }]);
    expect(found[0].faqs).toEqual([{ question: "Nasıl kullanılır?", answer: "Günde bir ölçek." }]);
  });

  it("overwrites the draft for the same page rather than duplicating", async () => {
    const url = "https://example.com/overwrite";
    await repository.save(PageContentDraft.create(projectId, url, "First", "m1", [], []));
    await repository.save(PageContentDraft.create(projectId, url, "Second", "m2", [], []));

    const rows = await prisma.pageContentDraft.findMany({ where: { projectId, pageUrl: url } });
    expect(rows).toHaveLength(1);
    expect(rows[0].suggestedTitle).toBe("Second");
  });
});
