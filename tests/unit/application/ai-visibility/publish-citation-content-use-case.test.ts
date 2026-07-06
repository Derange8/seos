import { describe, expect, it } from "vitest";
import { PublishCitationContentUseCase } from "@/application/ai-visibility/use-cases/publish-citation-content-use-case";
import type { CitationDraft } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import { WordPressConnection } from "@/domain/wordpress/entities/wordpress-connection";
import { ok } from "@/shared/result";
import { FakeWordPressClient, FakeWordPressConnectionRepository } from "../wordpress/fakes";

function draft(overrides: Partial<CitationDraft> = {}): CitationDraft {
  return {
    title: "Why Choose Us",
    metaDescription: "A short summary",
    sections: [{ heading: "Overview", body: "Some content" }],
    faqs: [],
    ...overrides,
  };
}

function buildDeps() {
  return {
    wordPressConnectionRepository: new FakeWordPressConnectionRepository(),
    wordPressClient: new FakeWordPressClient(),
  };
}

describe("PublishCitationContentUseCase", () => {
  it("creates a new WordPress page from the draft's title/metaDescription/rendered sections", async () => {
    const deps = buildDeps();
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.createPostResult = ok({
      id: 99,
      postType: "page",
      currentTitle: "Why Choose Us",
      currentExcerpt: "A short summary",
      currentContent: "<h2>Overview</h2>\n<p>Some content</p>",
    });

    const useCase = new PublishCitationContentUseCase(deps);
    const result = await useCase.execute("project-1", draft());

    expect(result.ok).toBe(true);
    expect(deps.wordPressClient.createPostCalls).toHaveLength(1);
    expect(deps.wordPressClient.createPostCalls[0]).toEqual({
      title: "Why Choose Us",
      excerpt: "A short summary",
      content: "<h2>Overview</h2>\n<p>Some content</p>",
    });
  });

  it("includes rendered FAQ content when the draft has FAQs", async () => {
    const deps = buildDeps();
    deps.wordPressConnectionRepository.seed(WordPressConnection.create("project-1", "https://example.com", "bot", "pw"));
    deps.wordPressClient.createPostResult = ok({
      id: 99,
      postType: "page",
      currentTitle: "Why Choose Us",
      currentExcerpt: "A short summary",
      currentContent: "",
    });

    const useCase = new PublishCitationContentUseCase(deps);
    await useCase.execute(
      "project-1",
      draft({ faqs: [{ question: "Is it free?", answer: "Yes." }] })
    );

    expect(deps.wordPressClient.createPostCalls[0]?.content).toContain("Is it free?");
    expect(deps.wordPressClient.createPostCalls[0]?.content).toContain("Yes.");
  });

  it("returns WORDPRESS_NOT_CONNECTED when the project has no WordPress connection", async () => {
    const deps = buildDeps();

    const useCase = new PublishCitationContentUseCase(deps);
    const result = await useCase.execute("project-1", draft());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("WORDPRESS_NOT_CONNECTED");
    expect(deps.wordPressClient.createPostCalls).toHaveLength(0);
  });
});
