import { describe, expect, it } from "vitest";
import { DetectHreflangReciprocityUseCase } from "@/application/crawling/use-cases/detect-hreflang-reciprocity-use-case";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";
import { FakePageRepository } from "./fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("DetectHreflangReciprocityUseCase", () => {
  it("does not flag a fully reciprocal hreflang pair", async () => {
    const pageRepository = new FakePageRepository();
    const en = Page.create("job-1", url("https://example.com/en/"), {
      hreflangLinks: [{ hreflang: "tr", url: "https://example.com/tr/" }],
    });
    const tr = Page.create("job-1", url("https://example.com/tr/"), {
      hreflangLinks: [{ hreflang: "en", url: "https://example.com/en/" }],
    });
    await pageRepository.save("project-1", en);
    await pageRepository.save("project-1", tr);

    const useCase = new DetectHreflangReciprocityUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(en.hreflangMissingReturnTags).toEqual([]);
    expect(tr.hreflangMissingReturnTags).toEqual([]);
  });

  it("flags a one-way hreflang link with no return tag", async () => {
    const pageRepository = new FakePageRepository();
    const en = Page.create("job-1", url("https://example.com/en/"), {
      hreflangLinks: [{ hreflang: "tr", url: "https://example.com/tr/" }],
    });
    const tr = Page.create("job-1", url("https://example.com/tr/"), { hreflangLinks: [] });
    await pageRepository.save("project-1", en);
    await pageRepository.save("project-1", tr);

    const useCase = new DetectHreflangReciprocityUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(en.hreflangMissingReturnTags).toEqual([{ hreflang: "tr", url: "https://example.com/tr/" }]);
    expect(tr.hreflangMissingReturnTags).toEqual([]);
  });

  it("does not require the return tag's own hreflang value to match the outbound one (each side names the OTHER page's locale)", async () => {
    const pageRepository = new FakePageRepository();
    // en's tag for tr says hreflang="tr" (tr's own locale); tr's tag for
    // en says hreflang="en" (en's own locale) — different values on
    // purpose, and still fully reciprocal since both URLs match up.
    const en = Page.create("job-1", url("https://example.com/en/"), {
      hreflangLinks: [{ hreflang: "tr", url: "https://example.com/tr/" }],
    });
    const tr = Page.create("job-1", url("https://example.com/tr/"), {
      hreflangLinks: [{ hreflang: "en", url: "https://example.com/en/" }],
    });
    await pageRepository.save("project-1", en);
    await pageRepository.save("project-1", tr);

    const useCase = new DetectHreflangReciprocityUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(en.hreflangMissingReturnTags).toEqual([]);
    expect(tr.hreflangMissingReturnTags).toEqual([]);
  });

  it("flags a target that links back to a different URL entirely, not this source", async () => {
    const pageRepository = new FakePageRepository();
    const en = Page.create("job-1", url("https://example.com/en/"), {
      hreflangLinks: [{ hreflang: "tr", url: "https://example.com/tr/" }],
    });
    const tr = Page.create("job-1", url("https://example.com/tr/"), {
      hreflangLinks: [{ hreflang: "de", url: "https://example.com/de/" }],
    });
    await pageRepository.save("project-1", en);
    await pageRepository.save("project-1", tr);

    const useCase = new DetectHreflangReciprocityUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(en.hreflangMissingReturnTags).toEqual([{ hreflang: "tr", url: "https://example.com/tr/" }]);
  });

  it("does not flag a hreflang link pointing at a page the crawl never reached", async () => {
    const pageRepository = new FakePageRepository();
    const en = Page.create("job-1", url("https://example.com/en/"), {
      hreflangLinks: [{ hreflang: "fr", url: "https://example.fr/" }],
    });
    await pageRepository.save("project-1", en);

    const useCase = new DetectHreflangReciprocityUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(en.hreflangMissingReturnTags).toEqual([]);
  });

  it("skips pages with no hreflang links at all", async () => {
    const pageRepository = new FakePageRepository();
    const home = Page.create("job-1", url("https://example.com/"), { hreflangLinks: [] });
    await pageRepository.save("project-1", home);

    const useCase = new DetectHreflangReciprocityUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(pageRepository.saved).toHaveLength(1);
  });

  it("clears a previously-flagged missing return tag once the target adds one back", async () => {
    const pageRepository = new FakePageRepository();
    const en = Page.create("job-1", url("https://example.com/en/"), {
      hreflangLinks: [{ hreflang: "tr", url: "https://example.com/tr/" }],
      hreflangMissingReturnTags: [{ hreflang: "tr", url: "https://example.com/tr/" }],
    });
    const tr = Page.create("job-1", url("https://example.com/tr/"), {
      hreflangLinks: [{ hreflang: "en", url: "https://example.com/en/" }],
    });
    await pageRepository.save("project-1", en);
    await pageRepository.save("project-1", tr);

    const useCase = new DetectHreflangReciprocityUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(en.hreflangMissingReturnTags).toEqual([]);
  });
});
