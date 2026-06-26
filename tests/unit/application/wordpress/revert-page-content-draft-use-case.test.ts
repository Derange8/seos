import { describe, expect, it } from "vitest";
import { RevertPageContentDraftUseCase } from "@/application/wordpress/use-cases/revert-page-content-draft-use-case";
import { WordPressUnreachableError } from "@/application/wordpress/ports/wordpress-client-port";
import { PageContentDraft } from "@/domain/content-enrichment/entities/page-content-draft";
import { WordPressConnection } from "@/domain/wordpress/entities/wordpress-connection";
import { ok, err } from "@/shared/result";
import { FakePageContentDraftRepository } from "../content-enrichment/fakes";
import { FakeWordPressClient, FakeWordPressConnectionRepository } from "./fakes";

function buildDeps() {
  return {
    pageContentDraftRepository: new FakePageContentDraftRepository(),
    wordPressConnectionRepository: new FakeWordPressConnectionRepository(),
    wordPressClient: new FakeWordPressClient(),
  };
}

function publishedDraft(): PageContentDraft {
  const d = PageContentDraft.create(
    "project-1",
    "https://example.com/about",
    "New Title",
    "New description",
    [{ heading: "Section", content: "Body" }],
    []
  );
  d.markPublished("Old Title", "Old description", "<p>Old content</p>");
  return d;
}

describe("RevertPageContentDraftUseCase", () => {
  it("pushes previous title/excerpt/content back to WordPress and reverts to DRAFT", async () => {
    const deps = buildDeps();
    const d = publishedDraft();
    deps.pageContentDraftRepository.seed(d);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    const post = {
      id: 1,
      postType: "page" as const,
      currentTitle: "New Title",
      currentExcerpt: "New description",
      currentContent: "<h2>Section</h2>\n<p>Body</p>",
    };
    deps.wordPressClient.findPostByUrlResult = ok(post);

    const useCase = new RevertPageContentDraftUseCase(deps);
    const result = await useCase.execute("project-1", d.id);

    expect(result.ok).toBe(true);
    expect(d.status).toBe("DRAFT");
    expect(d.previousTitle).toBeNull();
    expect(deps.wordPressClient.updateTitleCalls).toEqual([{ post, title: "Old Title" }]);
    expect(deps.wordPressClient.updateExcerptCalls).toEqual([{ post, excerpt: "Old description" }]);
    expect(deps.wordPressClient.updateContentCalls).toEqual([{ post, content: "<p>Old content</p>" }]);
  });

  it("returns PAGE_CONTENT_DRAFT_NOT_FOUND for an unknown id", async () => {
    const deps = buildDeps();

    const useCase = new RevertPageContentDraftUseCase(deps);
    const result = await useCase.execute("project-1", "does-not-exist");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PAGE_CONTENT_DRAFT_NOT_FOUND");
  });

  it("returns PAGE_CONTENT_DRAFT_NOT_PUBLISHED for a DRAFT draft", async () => {
    const deps = buildDeps();
    const d = PageContentDraft.create("project-1", "https://example.com/about", "Title", "Meta", [], []);
    deps.pageContentDraftRepository.seed(d);

    const useCase = new RevertPageContentDraftUseCase(deps);
    const result = await useCase.execute("project-1", d.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PAGE_CONTENT_DRAFT_NOT_PUBLISHED");
  });

  it("leaves the draft PUBLISHED when the WordPress push fails", async () => {
    const deps = buildDeps();
    const d = publishedDraft();
    deps.pageContentDraftRepository.seed(d);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = ok({
      id: 1,
      postType: "page",
      currentTitle: "New Title",
      currentExcerpt: "New description",
      currentContent: "<h2>Section</h2>\n<p>Body</p>",
    });
    deps.wordPressClient.updateTitleResult = err(new WordPressUnreachableError("network error"));

    const useCase = new RevertPageContentDraftUseCase(deps);
    const result = await useCase.execute("project-1", d.id);

    expect(result.ok).toBe(false);
    expect(d.status).toBe("PUBLISHED");
    expect(d.previousTitle).toBe("Old Title");
  });
});
