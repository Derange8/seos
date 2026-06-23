import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicContentIdeaProvider } from "@/infrastructure/llm/anthropic-content-idea-provider";
import type { ContentIdeaPageContext } from "@/application/content-enrichment/ports/content-idea-port";

function page(pageUrl: string): ContentIdeaPageContext {
  return { pageUrl, title: "Bromelain Syrup", h1: null };
}

function messagesResponse(text: string): Response {
  return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });
}

function idea(pageUrl = "https://example.com/a") {
  return {
    pageUrl,
    topic: "Bromelain Syrup",
    suggestedTitle: "What Does Bromelain Do?",
    suggestedSlug: "/blog/what-does-bromelain-do",
    rationale: "Common informational question for this product category.",
  };
}

describe("AnthropicContentIdeaProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty array without calling the API for an empty page list", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicContentIdeaProvider({ apiKey: "test-key" });

    const result = await provider.generateContentIdeas([]);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a request with the x-api-key header and parses a bare JSON array response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(messagesResponse(JSON.stringify([idea()])));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicContentIdeaProvider({ apiKey: "test-key" });

    const result = await provider.generateContentIdeas([page("https://example.com/a")]);

    expect(result).toEqual([idea()]);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "x-api-key": "test-key" });
  });

  it("strips a markdown code fence Claude sometimes adds despite instructions", async () => {
    const fenced = "```json\n" + JSON.stringify([idea()]) + "\n```";
    const fetchMock = vi.fn().mockResolvedValue(messagesResponse(fenced));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicContentIdeaProvider({ apiKey: "test-key" });

    const result = await provider.generateContentIdeas([page("https://example.com/a")]);

    expect(result).toEqual([idea()]);
  });

  it("throws when the response has no text content block", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicContentIdeaProvider({ apiKey: "test-key" });

    await expect(provider.generateContentIdeas([page("https://example.com/a")])).rejects.toThrow(/message content/);
  });
});
