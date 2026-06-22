import { describe, expect, it } from "vitest";
import { GenerateSitemapUseCase } from "@/application/sitemap/use-cases/generate-sitemap-use-case";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";
import { FakeSitemapRepository } from "./fakes";
import { FakePageRepository } from "../crawling/fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("GenerateSitemapUseCase", () => {
  it("includes only eligible pages and persists the result", async () => {
    const pageRepository = new FakePageRepository();
    await pageRepository.save(
      "project-1",
      Page.create("job-1", url("https://example.com/"), { statusCode: 200 })
    );
    await pageRepository.save(
      "project-1",
      Page.create("job-1", url("https://example.com/broken"), { statusCode: 404 })
    );

    const sitemapRepository = new FakeSitemapRepository();
    const useCase = new GenerateSitemapUseCase({ pageRepository, sitemapRepository });

    const sitemapFile = await useCase.execute("project-1", "job-1");

    expect(sitemapFile.pageCount).toBe(1);
    expect(sitemapFile.content).toContain("https://example.com/</loc>");
    expect(sitemapFile.content).not.toContain("/broken");
    expect(sitemapRepository.saved).toHaveLength(1);
  });

  it("produces an empty-but-valid sitemap for a crawl job with no eligible pages", async () => {
    const pageRepository = new FakePageRepository();
    const sitemapRepository = new FakeSitemapRepository();
    const useCase = new GenerateSitemapUseCase({ pageRepository, sitemapRepository });

    const sitemapFile = await useCase.execute("project-1", "job-empty");

    expect(sitemapFile.pageCount).toBe(0);
    expect(sitemapFile.content).toContain("<urlset");
  });
});
