import { describe, expect, it } from "vitest";
import { DetectDuplicateContentUseCase } from "@/application/crawling/use-cases/detect-duplicate-content-use-case";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";
import { FakePageRepository } from "./fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("DetectDuplicateContentUseCase", () => {
  it("marks two pages with the exact same title as duplicates", async () => {
    const pageRepository = new FakePageRepository();
    const a = Page.create("job-1", url("https://example.com/a"), { title: "Same Title" });
    const b = Page.create("job-1", url("https://example.com/b"), { title: "Same Title" });
    await pageRepository.save("project-1", a);
    await pageRepository.save("project-1", b);

    const useCase = new DetectDuplicateContentUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(a.hasDuplicateTitle).toBe(true);
    expect(b.hasDuplicateTitle).toBe(true);
  });

  it("is case- and whitespace-insensitive when comparing titles", async () => {
    const pageRepository = new FakePageRepository();
    const a = Page.create("job-1", url("https://example.com/a"), { title: "Same Title" });
    const b = Page.create("job-1", url("https://example.com/b"), { title: "  same title  " });
    await pageRepository.save("project-1", a);
    await pageRepository.save("project-1", b);

    const useCase = new DetectDuplicateContentUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(a.hasDuplicateTitle).toBe(true);
    expect(b.hasDuplicateTitle).toBe(true);
  });

  it("does not flag pages with different titles", async () => {
    const pageRepository = new FakePageRepository();
    const a = Page.create("job-1", url("https://example.com/a"), { title: "Title A" });
    const b = Page.create("job-1", url("https://example.com/b"), { title: "Title B" });
    await pageRepository.save("project-1", a);
    await pageRepository.save("project-1", b);

    const useCase = new DetectDuplicateContentUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(a.hasDuplicateTitle).toBe(false);
    expect(b.hasDuplicateTitle).toBe(false);
  });

  it("does not flag pages that both lack a title (missing-title-rule's job, not this)", async () => {
    const pageRepository = new FakePageRepository();
    const a = Page.create("job-1", url("https://example.com/a"), { title: null });
    const b = Page.create("job-1", url("https://example.com/b"), { title: null });
    await pageRepository.save("project-1", a);
    await pageRepository.save("project-1", b);

    const useCase = new DetectDuplicateContentUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(a.hasDuplicateTitle).toBe(false);
    expect(b.hasDuplicateTitle).toBe(false);
  });

  it("marks two pages with the exact same meta description as duplicates", async () => {
    const pageRepository = new FakePageRepository();
    const a = Page.create("job-1", url("https://example.com/a"), { metaDescription: "Same description" });
    const b = Page.create("job-1", url("https://example.com/b"), { metaDescription: "Same description" });
    await pageRepository.save("project-1", a);
    await pageRepository.save("project-1", b);

    const useCase = new DetectDuplicateContentUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(a.hasDuplicateMetaDescription).toBe(true);
    expect(b.hasDuplicateMetaDescription).toBe(true);
  });

  it("clears a previously-set duplicate flag once the title becomes unique", async () => {
    const pageRepository = new FakePageRepository();
    const a = Page.create("job-1", url("https://example.com/a"), { title: "Title A" });
    a.setDuplicateFlags(true, false, false);
    await pageRepository.save("project-1", a);

    const useCase = new DetectDuplicateContentUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(a.hasDuplicateTitle).toBe(false);
  });

  it("only re-saves pages whose duplicate flags actually changed", async () => {
    const pageRepository = new FakePageRepository();
    const a = Page.create("job-1", url("https://example.com/a"), { title: "Title A" });
    const b = Page.create("job-1", url("https://example.com/b"), { title: "Title B" });
    await pageRepository.save("project-1", a);
    await pageRepository.save("project-1", b);

    const useCase = new DetectDuplicateContentUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(pageRepository.saved).toHaveLength(2);
  });

  it("marks two pages with the exact same visible content (contentHash) as duplicates", async () => {
    const pageRepository = new FakePageRepository();
    const a = Page.create("job-1", url("https://example.com/a"), { contentHash: "hash-x", wordCount: 50 });
    const b = Page.create("job-1", url("https://example.com/b"), { contentHash: "hash-x", wordCount: 50 });
    await pageRepository.save("project-1", a);
    await pageRepository.save("project-1", b);

    const useCase = new DetectDuplicateContentUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(a.hasDuplicateContent).toBe(true);
    expect(b.hasDuplicateContent).toBe(true);
  });

  it("does not flag two empty pages sharing a contentHash as duplicate content (thin-content-rule's job)", async () => {
    const pageRepository = new FakePageRepository();
    const a = Page.create("job-1", url("https://example.com/a"), { contentHash: "empty-hash", wordCount: 0 });
    const b = Page.create("job-1", url("https://example.com/b"), { contentHash: "empty-hash", wordCount: 0 });
    await pageRepository.save("project-1", a);
    await pageRepository.save("project-1", b);

    const useCase = new DetectDuplicateContentUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(a.hasDuplicateContent).toBe(false);
    expect(b.hasDuplicateContent).toBe(false);
  });

  it("does not flag a page as duplicate-title/description/content when it canonicalizes to a different URL", async () => {
    const pageRepository = new FakePageRepository();
    const a = Page.create("job-1", url("https://example.com/"), {
      title: "Same Title",
      metaDescription: "Same description",
      contentHash: "hash-x",
      wordCount: 50,
    });
    const b = Page.create("job-1", url("https://example.com/?tab=live"), {
      title: "Same Title",
      metaDescription: "Same description",
      contentHash: "hash-x",
      wordCount: 50,
      canonicalUrl: "https://example.com/",
    });
    await pageRepository.save("project-1", a);
    await pageRepository.save("project-1", b);

    const useCase = new DetectDuplicateContentUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(b.hasDuplicateTitle).toBe(false);
    expect(b.hasDuplicateMetaDescription).toBe(false);
    expect(b.hasDuplicateContent).toBe(false);
    // The canonical target itself is still the "real" page — nothing else
    // points away from it, so it's still eligible to be flagged if some
    // other, non-canonicalizing page also shared its title/content. Here
    // only b canonicalizes away, and a has no other duplicate, so a is
    // clean too.
    expect(a.hasDuplicateTitle).toBe(false);
  });

  it("still flags a page as duplicate when another page shares its content but does not canonicalize away", async () => {
    const pageRepository = new FakePageRepository();
    const a = Page.create("job-1", url("https://example.com/a"), { title: "Same Title" });
    const b = Page.create("job-1", url("https://example.com/b"), {
      title: "Same Title",
      canonicalUrl: "https://example.com/b",
    });
    await pageRepository.save("project-1", a);
    await pageRepository.save("project-1", b);

    const useCase = new DetectDuplicateContentUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(a.hasDuplicateTitle).toBe(true);
    expect(b.hasDuplicateTitle).toBe(true);
  });

  it("does not flag pages with different content", async () => {
    const pageRepository = new FakePageRepository();
    const a = Page.create("job-1", url("https://example.com/a"), { contentHash: "hash-x", wordCount: 50 });
    const b = Page.create("job-1", url("https://example.com/b"), { contentHash: "hash-y", wordCount: 50 });
    await pageRepository.save("project-1", a);
    await pageRepository.save("project-1", b);

    const useCase = new DetectDuplicateContentUseCase({ pageRepository });
    await useCase.execute("project-1", "job-1");

    expect(a.hasDuplicateContent).toBe(false);
    expect(b.hasDuplicateContent).toBe(false);
  });
});
