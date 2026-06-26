import { describe, expect, it } from "vitest";
import { PublishPageContentDraftUseCase } from "@/application/wordpress/use-cases/publish-page-content-draft-use-case";
import { WordPressPostNotFoundError, WordPressUnreachableError } from "@/application/wordpress/ports/wordpress-client-port";
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

function draft(): PageContentDraft {
  return PageContentDraft.create(
    "project-1",
    "https://example.com/about",
    "New Title",
    "New description",
    [{ heading: "Section", content: "Body" }],
    []
  );
}

describe("PublishPageContentDraftUseCase", () => {
  it("pushes title, excerpt, and rendered content to WordPress and marks PUBLISHED", async () => {
    const deps = buildDeps();
    const d = draft();
    deps.pageContentDraftRepository.seed(d);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    const post = {
      id: 1,
      postType: "page" as const,
      currentTitle: "Old Title",
      currentExcerpt: "Old description",
      currentContent: "<p>Old content</p>",
    };
    deps.wordPressClient.findPostByUrlResult = ok(post);

    const useCase = new PublishPageContentDraftUseCase(deps);
    const result = await useCase.execute("project-1", d.id);

    expect(result.ok).toBe(true);
    expect(d.status).toBe("PUBLISHED");
    expect(d.previousTitle).toBe("Old Title");
    expect(d.previousMetaDescription).toBe("Old description");
    expect(d.previousContent).toBe("<p>Old content</p>");
    expect(deps.wordPressClient.updateTitleCalls).toEqual([{ post, title: "New Title" }]);
    expect(deps.wordPressClient.updateExcerptCalls).toEqual([{ post, excerpt: "New description" }]);
    expect(deps.wordPressClient.updateContentCalls).toEqual([{ post, content: "<h2>Section</h2>\n<p>Body</p>" }]);
  });

  it("returns PAGE_CONTENT_DRAFT_NOT_FOUND for an unknown id", async () => {
    const deps = buildDeps();

    const useCase = new PublishPageContentDraftUseCase(deps);
    const result = await useCase.execute("project-1", "does-not-exist");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PAGE_CONTENT_DRAFT_NOT_FOUND");
  });

  it("returns PAGE_CONTENT_DRAFT_NOT_FOUND when the draft belongs to a different project", async () => {
    const deps = buildDeps();
    const d = draft();
    deps.pageContentDraftRepository.seed(d);

    const useCase = new PublishPageContentDraftUseCase(deps);
    const result = await useCase.execute("project-2", d.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PAGE_CONTENT_DRAFT_NOT_FOUND");
  });

  it("returns WORDPRESS_NOT_CONNECTED when the project has no connection", async () => {
    const deps = buildDeps();
    const d = draft();
    deps.pageContentDraftRepository.seed(d);

    const useCase = new PublishPageContentDraftUseCase(deps);
    const result = await useCase.execute("project-1", d.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WORDPRESS_NOT_CONNECTED");
  });

  it("returns PAGE_CONTENT_DRAFT_ALREADY_PUBLISHED rather than re-publishing", async () => {
    const deps = buildDeps();
    const d = draft();
    d.markPublished("Old Title", "Old description", "<p>Old content</p>");
    deps.pageContentDraftRepository.seed(d);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));

    const useCase = new PublishPageContentDraftUseCase(deps);
    const result = await useCase.execute("project-1", d.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PAGE_CONTENT_DRAFT_ALREADY_PUBLISHED");
    expect(deps.wordPressClient.updateTitleCalls).toEqual([]);
  });

  it("marks the draft FAILED, not stuck DRAFT, when the WordPress lookup fails", async () => {
    const deps = buildDeps();
    const d = draft();
    deps.pageContentDraftRepository.seed(d);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = err(new WordPressPostNotFoundError("no matching post"));

    const useCase = new PublishPageContentDraftUseCase(deps);
    const result = await useCase.execute("project-1", d.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WORDPRESS_POST_NOT_FOUND");
    expect(d.status).toBe("FAILED");
  });

  it("marks the draft FAILED when the title update succeeds but the content update fails", async () => {
    const deps = buildDeps();
    const d = draft();
    deps.pageContentDraftRepository.seed(d);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = ok({
      id: 1,
      postType: "page",
      currentTitle: "Old Title",
      currentExcerpt: "Old description",
      currentContent: "<p>Old content</p>",
    });
    deps.wordPressClient.updateContentResult = err(new WordPressUnreachableError("network error"));

    const useCase = new PublishPageContentDraftUseCase(deps);
    const result = await useCase.execute("project-1", d.id);

    expect(result.ok).toBe(false);
    expect(d.status).toBe("FAILED");
    expect(deps.wordPressClient.updateTitleCalls).toHaveLength(1);
    expect(deps.wordPressClient.updateExcerptCalls).toHaveLength(1);
  });

  it("can retry after a FAILED attempt", async () => {
    const deps = buildDeps();
    const d = draft();
    d.markFailed();
    deps.pageContentDraftRepository.seed(d);
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.findPostByUrlResult = ok({
      id: 1,
      postType: "page",
      currentTitle: "Old Title",
      currentExcerpt: "Old description",
      currentContent: "<p>Old content</p>",
    });

    const useCase = new PublishPageContentDraftUseCase(deps);
    const result = await useCase.execute("project-1", d.id);

    expect(result.ok).toBe(true);
    expect(d.status).toBe("PUBLISHED");
  });
});
