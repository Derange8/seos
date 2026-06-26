import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiContentSuggestionProvider } from "@/infrastructure/llm/openai-content-suggestion-provider";
import type { ContentEnrichmentContext } from "@/application/content-enrichment/ports/content-enrichment-port";

function context(): ContentEnrichmentContext {
  return { pageUrl: "https://example.com/a", query: "bromelain syrup benefits", position: 14, impressions: 320 };
}

function chatCompletionResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

describe("OpenAiContentSuggestionProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the context as the user message and returns the trimmed suggestion text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatCompletionResponse("  Add a section about X.  "));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiContentSuggestionProvider({ apiKey: "test-key" });

    const result = await provider.generateSuggestion(context());

    expect(result).toBe("Add a section about X.");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ authorization: "Bearer test-key" });
    const body = JSON.parse(init.body as string);
    expect(body.messages[1]).toEqual({ role: "user", content: JSON.stringify(context()) });
  });

  it("throws when the API responds with a non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiContentSuggestionProvider({ apiKey: "test-key" });

    await expect(provider.generateSuggestion(context())).rejects.toThrow(/429/);
  });

  it("throws when the response has no message content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiContentSuggestionProvider({ apiKey: "test-key" });

    await expect(provider.generateSuggestion(context())).rejects.toThrow(/message content/);
  });

  it("uses a custom baseUrl and model when given, for OpenAI-compatible providers like DeepSeek", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatCompletionResponse("Suggestion."));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiContentSuggestionProvider({
      apiKey: "test-key",
      baseUrl: "https://api.deepseek.com/v1/chat/completions",
      model: "deepseek-chat",
    });

    await provider.generateSuggestion(context());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("deepseek-chat");
  });
});
