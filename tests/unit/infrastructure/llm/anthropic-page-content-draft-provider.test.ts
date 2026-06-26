import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicPageContentDraftProvider } from "@/infrastructure/llm/anthropic-page-content-draft-provider";
import type { PageContentDraftContext } from "@/application/content-enrichment/ports/page-content-draft-port";

function ctx(): PageContentDraftContext {
  return { pageUrl: "https://example.com/p", title: "Bromelain", h1: null, contentExcerpt: "x", existingFaqCount: 0 };
}

function messagesResponse(text: string): Response {
  return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });
}

function result() {
  return {
    suggestedTitle: "Bromelain Şurubu",
    suggestedMetaDescription: "Faydaları ve kullanımı.",
    bodySections: [{ heading: "Nedir", content: "Ananas enzimi." }],
    faqs: [{ question: "Nasıl?", answer: "Günde bir." }],
  };
}

describe("AnthropicPageContentDraftProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the x-api-key header and parses the draft result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(messagesResponse(JSON.stringify(result())));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicPageContentDraftProvider({ apiKey: "test-key" });

    const parsed = await provider.generateDraft(ctx());

    expect(parsed).toEqual(result());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers).toMatchObject({ "x-api-key": "test-key", "anthropic-version": "2023-06-01" });
  });

  it("strips a markdown code fence Claude sometimes adds despite instructions", async () => {
    const fenced = "```json\n" + JSON.stringify(result()) + "\n```";
    const fetchMock = vi.fn().mockResolvedValue(messagesResponse(fenced));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicPageContentDraftProvider({ apiKey: "test-key" });

    const parsed = await provider.generateDraft(ctx());

    expect(parsed).toEqual(result());
  });

  it("throws when the API responds with a non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicPageContentDraftProvider({ apiKey: "test-key" });

    await expect(provider.generateDraft(ctx())).rejects.toThrow(/429/);
  });

  it("throws when the response has no text content block", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicPageContentDraftProvider({ apiKey: "test-key" });

    await expect(provider.generateDraft(ctx())).rejects.toThrow(/message content/);
  });
});
