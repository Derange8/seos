import { describe, expect, it } from "vitest";
import { DetectBrokenLinksUseCase } from "@/application/crawling/use-cases/detect-broken-links-use-case";
import { Page } from "@/domain/crawling/entities/page";
import { Link } from "@/domain/crawling/entities/link";
import { Url } from "@/domain/crawling/value-objects/url";
import { FakePageRepository } from "./fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("DetectBrokenLinksUseCase", () => {
  it("marks an internal link broken when its target page returned an error status", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    const missing = Page.create("job-1", url("https://example.com/missing"), { statusCode: 404 });
    home.addLink(Link.create(home.id, home.url, missing.url));
    await pageRepository.save("project-1", home);
    await pageRepository.save("project-1", missing);

    const useCase = new DetectBrokenLinksUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(home.allLinks[0]?.isBroken).toBe(true);
  });

  it("does not mark a link broken when its target page returned a healthy status", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    const about = Page.create("job-1", url("https://example.com/about"), { statusCode: 200 });
    home.addLink(Link.create(home.id, home.url, about.url));
    await pageRepository.save("project-1", home);
    await pageRepository.save("project-1", about);

    const useCase = new DetectBrokenLinksUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(home.allLinks[0]?.isBroken).toBe(false);
  });

  it("leaves external links untouched, even when they're unreachable", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    home.addLink(Link.create(home.id, home.url, url("https://other.example.com/missing")));
    await pageRepository.save("project-1", home);

    const useCase = new DetectBrokenLinksUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(home.allLinks[0]?.isBroken).toBe(false);
  });

  it("does not mark an internal link broken when its target was never crawled (out of scope, not known-broken)", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    home.addLink(Link.create(home.id, home.url, url("https://example.com/never-crawled")));
    await pageRepository.save("project-1", home);

    const useCase = new DetectBrokenLinksUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(home.allLinks[0]?.isBroken).toBe(false);
  });

  it("only re-saves pages whose links actually changed", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    const about = Page.create("job-1", url("https://example.com/about"), { statusCode: 200 });
    home.addLink(Link.create(home.id, home.url, about.url));
    await pageRepository.save("project-1", home);
    await pageRepository.save("project-1", about);

    const useCase = new DetectBrokenLinksUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(pageRepository.saved).toHaveLength(2);
  });
});
