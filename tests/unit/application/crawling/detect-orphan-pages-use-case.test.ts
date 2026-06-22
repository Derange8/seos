import { describe, expect, it } from "vitest";
import { DetectOrphanPagesUseCase } from "@/application/crawling/use-cases/detect-orphan-pages-use-case";
import { Page } from "@/domain/crawling/entities/page";
import { Link } from "@/domain/crawling/entities/link";
import { Url } from "@/domain/crawling/value-objects/url";
import { FakePageRepository } from "./fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("DetectOrphanPagesUseCase", () => {
  it("marks a page orphan when no other crawled page links to it internally", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    const about = Page.create("job-1", url("https://example.com/about"), { statusCode: 200 });
    const orphan = Page.create("job-1", url("https://example.com/orphan"), { statusCode: 200 });
    home.addLink(Link.create(home.id, home.url, about.url));
    await pageRepository.save("project-1", home);
    await pageRepository.save("project-1", about);
    await pageRepository.save("project-1", orphan);

    const useCase = new DetectOrphanPagesUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(orphan.isOrphan).toBe(true);
    expect(about.isOrphan).toBe(false);
  });

  it("never marks the root page (earliest crawledAt) as orphan, even with no inbound links", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    const about = Page.create("job-1", url("https://example.com/about"), { statusCode: 200 });
    home.addLink(Link.create(home.id, home.url, about.url));
    await pageRepository.save("project-1", home);
    await pageRepository.save("project-1", about);

    const useCase = new DetectOrphanPagesUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(home.isOrphan).toBe(false);
  });

  it("does not mark a page orphan when a non-root page links to it", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    const about = Page.create("job-1", url("https://example.com/about"), { statusCode: 200 });
    const team = Page.create("job-1", url("https://example.com/team"), { statusCode: 200 });
    home.addLink(Link.create(home.id, home.url, about.url));
    about.addLink(Link.create(about.id, about.url, team.url));
    await pageRepository.save("project-1", home);
    await pageRepository.save("project-1", about);
    await pageRepository.save("project-1", team);

    const useCase = new DetectOrphanPagesUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(team.isOrphan).toBe(false);
  });

  it("clears a previously-set orphan flag once a link to the page is found", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    const about = Page.create("job-1", url("https://example.com/about"), { statusCode: 200 });
    about.setOrphan(true);
    home.addLink(Link.create(home.id, home.url, about.url));
    await pageRepository.save("project-1", home);
    await pageRepository.save("project-1", about);

    const useCase = new DetectOrphanPagesUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(about.isOrphan).toBe(false);
  });

  it("only re-saves pages whose orphan flag actually changed", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { statusCode: 200 });
    const about = Page.create("job-1", url("https://example.com/about"), { statusCode: 200 });
    home.addLink(Link.create(home.id, home.url, about.url));
    await pageRepository.save("project-1", home);
    await pageRepository.save("project-1", about);

    const useCase = new DetectOrphanPagesUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(pageRepository.saved).toHaveLength(2);
  });
});
