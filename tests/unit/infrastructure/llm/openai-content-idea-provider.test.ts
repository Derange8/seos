import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiContentIdeaProvider, parseContentIdeaSuggestions } from "@/infrastructure/llm/openai-content-idea-provider";
import type { ContentIdeaPageContext } from "@/application/content-enrichment/ports/content-idea-port";

function page(pageUrl: string, title: string | null = "Bromelain Syrup"): ContentIdeaPageContext {
  return { pageUrl, title, h1: null };
}

function chatCompletionResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
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

describe("parseContentIdeaSuggestions", () => {
  it("parses a bare JSON array", () => {
    const result = parseContentIdeaSuggestions(JSON.stringify([idea()]));
    expect(result).toEqual([idea()]);
  });

  it("parses an array nested in a wrapper object (json_object mode shape)", () => {
    const result = parseContentIdeaSuggestions(JSON.stringify({ ideas: [idea()] }));
    expect(result).toEqual([idea()]);
  });

  it("strips a markdown code fence before parsing", () => {
    const result = parseContentIdeaSuggestions("```json\n" + JSON.stringify([idea()]) + "\n```");
    expect(result).toEqual([idea()]);
  });

  it("drops an entry missing a required field rather than failing the whole batch", () => {
    const incomplete = { ...idea(), suggestedSlug: undefined };
    const result = parseContentIdeaSuggestions(JSON.stringify([idea(), incomplete]));
    expect(result).toHaveLength(1);
  });

  it("returns an empty array when there is no array to find", () => {
    expect(parseContentIdeaSuggestions(JSON.stringify({ note: "no ideas here" }))).toEqual([]);
  });

  it("throws when the content is not valid JSON", () => {
    expect(() => parseContentIdeaSuggestions("not json")).toThrow(/valid JSON/);
  });
});

describe("OpenAiContentIdeaProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty array without calling the API for an empty page list", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiContentIdeaProvider({ apiKey: "test-key" });

    const result = await provider.generateContentIdeas([]);

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a request and parses ideas wrapped in a json_object response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatCompletionResponse(JSON.stringify({ ideas: [idea()] })));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiContentIdeaProvider({ apiKey: "test-key" });

    const result = await provider.generateContentIdeas([page("https://example.com/a")]);

    expect(result).toEqual([idea()]);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ authorization: "Bearer test-key" });
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("throws when the API responds with a non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiContentIdeaProvider({ apiKey: "test-key" });

    await expect(provider.generateContentIdeas([page("https://example.com/a")])).rejects.toThrow(/429/);
  });

  it("uses a custom baseUrl when given, for OpenAI-compatible providers like DeepSeek", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatCompletionResponse(JSON.stringify({ ideas: [] })));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiContentIdeaProvider({
      apiKey: "test-key",
      baseUrl: "https://api.deepseek.com/v1/chat/completions",
      model: "deepseek-chat",
    });

    await provider.generateContentIdeas([page("https://example.com/a")]);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
  });
});
