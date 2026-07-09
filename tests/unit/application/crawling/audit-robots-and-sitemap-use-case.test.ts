import { describe, expect, it } from "vitest";
import { AuditRobotsAndSitemapUseCase } from "@/application/crawling/use-cases/audit-robots-and-sitemap-use-case";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";
import { PageFetchError, type PageFetchResult } from "@/application/crawling/ports/page-fetch-result";
import type { PageFetcherPort } from "@/application/crawling/ports/page-fetcher-port";
import { ok, err, type Result } from "@/shared/result";
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
    contentType: null,
  });
}

// Real sitemap index resolution needs a different response per URL
// fetched (the index itself, then each child leaf sitemap) — unlike
// FakePageFetcher's single fixed result, this dispatches on the
// requested URL.
class RoutingFakePageFetcher implements PageFetcherPort {
  constructor(private readonly byUrl: Map<string, Result<PageFetchResult, PageFetchError>>) {}

  async fetch(target: Url): Promise<Result<PageFetchResult, PageFetchError>> {
    return (
      this.byUrl.get(target.href) ?? err(new PageFetchError("HTTP_ERROR", `no fake response for ${target.href}`))
    );
  }
}

function sitemapResponse(html: string): Result<PageFetchResult, PageFetchError> {
  return ok({
    finalUrl: url("https://example.com/sitemap.xml"),
    statusCode: 200,
    html,
    responseTimeMs: 10,
    redirectChain: [],
    renderMode: "HTTP" as const,
    cspHeader: null,
    contentType: null,
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
      contentType: null,
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
        contentType: null,
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

  it("marks every page's isInSitemap based on whether its URL appears in the live sitemap.xml", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const listed = Page.create("job-1", url("https://example.com/listed"), { statusCode: 404 });
    const notListed = Page.create("job-1", url("https://example.com/gone"), { statusCode: 404 });
    await pageRepository.save("project-1", home);
    await pageRepository.save("project-1", listed);
    await pageRepository.save("project-1", notListed);

    const robots = new FakeRobotsPort(ok(null));
    const pageFetcher = new FakePageFetcher(
      sitemapFetchOk(
        `<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/listed</loc></url></urlset>`
      )
    );

    const useCase = new AuditRobotsAndSitemapUseCase({ pageRepository, robots, pageFetcher });
    await useCase.execute("project-1", "job-1");

    expect(home.isInSitemap).toBe(true);
    expect(listed.isInSitemap).toBe(true);
    expect(notListed.isInSitemap).toBe(false);
  });

  it("follows a <sitemapindex> into its child leaf sitemaps and merges their page URLs", async () => {
    // The real WordPress/Yoast shape: /sitemap.xml is an index listing
    // sitemap *files*, not page URLs — page-sitemap.xml and
    // post-sitemap.xml each list actual pages.
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    const aboutPage = Page.create("job-1", url("https://example.com/about"), { statusCode: 404 });
    const blogPost = Page.create("job-1", url("https://example.com/blog/hello"), { statusCode: 404 });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await pageRepository.save("project-1", home);
    await pageRepository.save("project-1", aboutPage);
    await pageRepository.save("project-1", blogPost);

    const robots = new FakeRobotsPort(ok(null));
    const pageFetcher = new RoutingFakePageFetcher(
      new Map([
        [
          "https://example.com/sitemap.xml",
          sitemapResponse(
            `<sitemapindex><sitemap><loc>https://example.com/page-sitemap.xml</loc></sitemap><sitemap><loc>https://example.com/post-sitemap.xml</loc></sitemap></sitemapindex>`
          ),
        ],
        [
          "https://example.com/page-sitemap.xml",
          sitemapResponse(
            `<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/about</loc></url></urlset>`
          ),
        ],
        [
          "https://example.com/post-sitemap.xml",
          sitemapResponse(`<urlset><url><loc>https://example.com/blog/hello</loc></url></urlset>`),
        ],
      ])
    );

    const useCase = new AuditRobotsAndSitemapUseCase({ pageRepository, robots, pageFetcher });
    await useCase.execute("project-1", "job-1");

    expect(home.isInSitemap).toBe(true);
    expect(aboutPage.isInSitemap).toBe(true);
    expect(blogPost.isInSitemap).toBe(true);
  });

  it("skips a child sitemap that fails to fetch without losing the other children's URLs", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    const aboutPage = Page.create("job-1", url("https://example.com/about"), { statusCode: 404 });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await pageRepository.save("project-1", home);
    await pageRepository.save("project-1", aboutPage);

    const robots = new FakeRobotsPort(ok(null));
    const pageFetcher = new RoutingFakePageFetcher(
      new Map([
        [
          "https://example.com/sitemap.xml",
          sitemapResponse(
            `<sitemapindex><sitemap><loc>https://example.com/broken-sitemap.xml</loc></sitemap><sitemap><loc>https://example.com/page-sitemap.xml</loc></sitemap></sitemapindex>`
          ),
        ],
        [
          "https://example.com/page-sitemap.xml",
          sitemapResponse(
            `<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/about</loc></url></urlset>`
          ),
        ],
        // broken-sitemap.xml deliberately has no fake response — the
        // RoutingFakePageFetcher returns an error for it.
      ])
    );

    const useCase = new AuditRobotsAndSitemapUseCase({ pageRepository, robots, pageFetcher });
    await useCase.execute("project-1", "job-1");

    expect(home.isInSitemap).toBe(true);
    expect(aboutPage.isInSitemap).toBe(true);
  });

  it("sets isInSitemap to null on every page when the sitemap can't be determined this run", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    const other = Page.create("job-1", url("https://example.com/other"), { statusCode: 200 });
    await pageRepository.save("project-1", home);
    await pageRepository.save("project-1", other);

    const robots = new FakeRobotsPort(ok(null));
    const pageFetcher = new FakePageFetcher(err(new PageFetchError("HTTP_ERROR", "not found")));

    const useCase = new AuditRobotsAndSitemapUseCase({ pageRepository, robots, pageFetcher });
    await useCase.execute("project-1", "job-1");

    expect(home.isInSitemap).toBeNull();
    expect(other.isInSitemap).toBeNull();
  });

  it("sets isInSitemap to null on every page when the sitemap is reachable but malformed", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    await pageRepository.save("project-1", home);

    const robots = new FakeRobotsPort(ok(null));
    const pageFetcher = new FakePageFetcher(sitemapFetchOk(`<urlset><url><loc>truncated`));

    const useCase = new AuditRobotsAndSitemapUseCase({ pageRepository, robots, pageFetcher });
    await useCase.execute("project-1", "job-1");

    expect(home.isInSitemap).toBeNull();
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
        contentType: null,
      })
    );

    const useCase = new AuditRobotsAndSitemapUseCase({ pageRepository, robots, pageFetcher });
    await useCase.execute("project-1", "job-1");

    expect(home.robotsBlocksEntireSite).toBe(true);
    expect(about.robotsBlocksEntireSite).toBe(false);
  });
});
