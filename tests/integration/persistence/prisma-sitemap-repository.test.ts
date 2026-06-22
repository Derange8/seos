import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaSitemapRepository } from "@/infrastructure/persistence/prisma/prisma-sitemap-repository";
import { SitemapFile } from "@/domain/sitemap/entities/sitemap-file";

describe("PrismaSitemapRepository", () => {
  const repository = new PrismaSitemapRepository(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Sitemap Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("round-trips a sitemap file", async () => {
    const sitemapFile = SitemapFile.create(projectId, "<urlset></urlset>", 0);

    await repository.save(sitemapFile);
    const found = await repository.findLatestByProjectId(projectId);

    expect(found?.id).toBe(sitemapFile.id);
    expect(found?.content).toBe("<urlset></urlset>");
    expect(found?.pageCount).toBe(0);
  });

  it("findLatestByProjectId returns the most recently generated sitemap", async () => {
    const earlier = SitemapFile.create(projectId, "<urlset><!-- earlier --></urlset>", 1);
    await repository.save(earlier);

    // A small delay so `later`'s generatedAt (stamped at construction, not
    // at save time) is unambiguously after `earlier`'s.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const later = SitemapFile.create(projectId, "<urlset><!-- later --></urlset>", 2);
    await repository.save(later);

    const found = await repository.findLatestByProjectId(projectId);
    expect(found?.id).toBe(later.id);
  });

  it("returns null when no sitemap exists for a project", async () => {
    const found = await repository.findLatestByProjectId(crypto.randomUUID());
    expect(found).toBeNull();
  });
});
