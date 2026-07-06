import { describe, expect, it } from "vitest";
import { AuditRobotsAndSitemapUseCase } from "@/application/crawling/use-cases/audit-robots-and-sitemap-use-case";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";
import { PageFetchError } from "@/application/crawling/ports/page-fetch-result";
import { ok, err } from "@/shared/result";
import { FakePageRepository, FakeRobotsPort, FakePageFetcher } from "./fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function sitemapFetchOk(html: string) {
  return ok({
    finalUrl: url("https://example.com/sitemap.xml"),
    statusCode: 200,
    html,
    responseTimeMs: 10,
    redirectChain: [],
    renderMode: "HTTP" as const,
    cspHeader: null,
  });
}

describe("AuditRobotsAndSitemapUseCase", () => {
  it("does nothing when the crawl job has no pages", async () => {
    const pageRepository = new FakePageRepository();
    const robots = new FakeRobotsPort();
    const pageFetcher = new FakePageFetcher(ok({
      finalUrl: url("https://example.com/sitemap.xml"),
      statusCode: 404,
      html: "",
      responseTimeMs: 10,
      redirectChain: [],
      renderMode: "HTTP",
      cspHeader: null,
    }));

    const useCase = new AuditRobotsAndSitemapUseCase({ pageRepository, robots, pageFetcher });
    await useCase.execute("project-1", "job-1");

    expect(pageRepository.saved).toHaveLength(0);
  });

  it("marks the root page when robots.txt blocks the entire site and has no sitemap directive", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    await pageRepository.save("project-1", home);

    const robots = new FakeRobotsPort(ok("User-agent: *\nDisallow: /\n"));
    const pageFetcher = new FakePageFetcher(
      ok({
        finalUrl: url("https://example.com/sitemap.xml"),
        statusCode: 404,
        html: "",
        responseTimeMs: 10,
        redirectChain: [],
        renderMode: "HTTP",
        cspHeader: null,
      })
    );

    const useCase = new AuditRobotsAndSitemapUseCase({ pageRepository, robots, pageFetcher });
    await useCase.execute("project-1", "job-1");

    expect(home.robotsBlocksEntireSite).toBe(true);
    expect(home.robotsMissingSitemapDirective).toBe(true);
    expect(home.sitemapIsUnreachable).toBe(true);
    expect(home.sitemapIsInvalidXml).toBeNull();
  });

  it("marks the sitemap valid when it's reachable and well-formed", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    await pageRepository.save("project-1", home);

    const robots = new FakeRobotsPort(
      ok("User-agent: *\nDisallow:\nSitemap: https://example.com/sitemap.xml\n")
    );
    const pageFetcher = new FakePageFetcher(
      sitemapFetchOk(`<urlset><url><loc>https://example.com/</loc></url></urlset>`)
    );

    const useCase = new AuditRobotsAndSitemapUseCase({ pageRepository, robots, pageFetcher });
    await useCase.execute("project-1", "job-1");

    expect(home.robotsBlocksEntireSite).toBe(false);
    expect(home.robotsMissingSitemapDirective).toBe(false);
    expect(home.sitemapIsUnreachable).toBe(false);
    expect(home.sitemapIsInvalidXml).toBe(false);
  });

  it("marks the sitemap invalid when it's reachable but malformed", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    await pageRepository.save("project-1", home);

    const robots = new FakeRobotsPort(ok(null));
    const pageFetcher = new FakePageFetcher(sitemapFetchOk(`<urlset><url><loc>truncated`));

    const useCase = new AuditRobotsAndSitemapUseCase({ pageRepository, robots, pageFetcher });
    await useCase.execute("project-1", "job-1");

    expect(home.sitemapIsUnreachable).toBe(false);
    expect(home.sitemapIsInvalidXml).toBe(true);
  });

  it("treats no robots.txt found at all as neither blocking nor missing-directive", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    await pageRepository.save("project-1", home);

    const robots = new FakeRobotsPort(ok(null));
    const pageFetcher = new FakePageFetcher(
      err(new PageFetchError("HTTP_ERROR", "not found"))
    );

    const useCase = new AuditRobotsAndSitemapUseCase({ pageRepository, robots, pageFetcher });
    await useCase.execute("project-1", "job-1");

    expect(home.robotsBlocksEntireSite).toBe(false);
    expect(home.robotsMissingSitemapDirective).toBeNull();
    expect(home.sitemapIsUnreachable).toBe(true);
  });

  it("attaches findings to the root page (earliest crawledAt), not any other page", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const about = Page.create("job-1", url("https://example.com/about"), { statusCode: 200 });
    await pageRepository.save("project-1", about);
    await pageRepository.save("project-1", home);

    const robots = new FakeRobotsPort(ok("User-agent: *\nDisallow: /\n"));
    const pageFetcher = new FakePageFetcher(
      ok({
        finalUrl: url("https://example.com/sitemap.xml"),
        statusCode: 404,
        html: "",
        responseTimeMs: 10,
        redirectChain: [],
        renderMode: "HTTP",
        cspHeader: null,
      })
    );

    const useCase = new AuditRobotsAndSitemapUseCase({ pageRepository, robots, pageFetcher });
    await useCase.execute("project-1", "job-1");

    expect(home.robotsBlocksEntireSite).toBe(true);
    expect(about.robotsBlocksEntireSite).toBe(false);
  });
});
