import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicContentSuggestionProvider } from "@/infrastructure/llm/anthropic-content-suggestion-provider";
import type { ContentEnrichmentContext } from "@/application/content-enrichment/ports/content-enrichment-port";

function context(): ContentEnrichmentContext {
  return { pageUrl: "https://example.com/a", query: "bromelain syrup benefits", position: 14, impressions: 320 };
}

function messagesResponse(text: string): Response {
  return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });
}

describe("AnthropicContentSuggestionProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the x-api-key header and returns the trimmed suggestion text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(messagesResponse("  Add a section about X.  "));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicContentSuggestionProvider({ apiKey: "test-key" });

    const result = await provider.generateSuggestion(context());

    expect(result).toBe("Add a section about X.");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers).toMatchObject({ "x-api-key": "test-key", "anthropic-version": "2023-06-01" });
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual([{ role: "user", content: JSON.stringify(context()) }]);
  });

  it("throws when the API responds with a non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicContentSuggestionProvider({ apiKey: "test-key" });

    await expect(provider.generateSuggestion(context())).rejects.toThrow(/429/);
  });

  it("throws when the response has no text content block", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicContentSuggestionProvider({ apiKey: "test-key" });

    await expect(provider.generateSuggestion(context())).rejects.toThrow(/message content/);
  });
});
