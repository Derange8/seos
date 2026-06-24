import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiPageContentDraftProvider } from "@/infrastructure/llm/openai-page-content-draft-provider";
import { parsePageContentDraftResult } from "@/infrastructure/llm/page-content-draft-prompt";
import type { PageContentDraftContext } from "@/application/content-enrichment/ports/page-content-draft-port";

function ctx(): PageContentDraftContext {
  return { pageUrl: "https://example.com/p", title: "Bromelain", h1: null, contentExcerpt: "x", existingFaqCount: 0 };
}

function chatCompletionResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

function result() {
  return {
    suggestedTitle: "Bromelain Şurubu",
    suggestedMetaDescription: "Faydaları ve kullanımı.",
    bodySections: [{ heading: "Nedir", content: "Ananas enzimi." }],
    faqs: [{ question: "Nasıl?", answer: "Günde bir." }],
  };
}

describe("parsePageContentDraftResult", () => {
  it("parses a well-formed object", () => {
    expect(parsePageContentDraftResult(JSON.stringify(result()))).toEqual(result());
  });

  it("strips a markdown code fence", () => {
    expect(parsePageContentDraftResult("```json\n" + JSON.stringify(result()) + "\n```")).toEqual(result());
  });

  it("drops a malformed section/faq entry rather than failing", () => {
    const malformed = {
      ...result(),
      bodySections: [...result().bodySections, { heading: "only heading" }],
      faqs: [...result().faqs, { question: "no answer" }],
    };
    const parsed = parsePageContentDraftResult(JSON.stringify(malformed));
    expect(parsed.bodySections).toHaveLength(1);
    expect(parsed.faqs).toHaveLength(1);
  });

  it("falls back to empty values for missing fields", () => {
    expect(parsePageContentDraftResult(JSON.stringify({}))).toEqual({
      suggestedTitle: "",
      suggestedMetaDescription: "",
      bodySections: [],
      faqs: [],
    });
  });

  it("throws on invalid JSON", () => {
    expect(() => parsePageContentDraftResult("not json")).toThrow(/valid JSON/);
  });
});

describe("OpenAiPageContentDraftProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a request and parses the draft result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatCompletionResponse(JSON.stringify(result())));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiPageContentDraftProvider({ apiKey: "test-key" });

    const parsed = await provider.generateDraft(ctx());

    expect(parsed).toEqual(result());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ authorization: "Bearer test-key" });
    expect(JSON.parse(init.body as string).response_format).toEqual({ type: "json_object" });
  });

  it("throws on a non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiPageContentDraftProvider({ apiKey: "test-key" });

    await expect(provider.generateDraft(ctx())).rejects.toThrow(/429/);
  });

  it("uses a custom baseUrl for OpenAI-compatible providers like DeepSeek", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatCompletionResponse(JSON.stringify(result())));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiPageContentDraftProvider({
      apiKey: "k",
      baseUrl: "https://api.deepseek.com/v1/chat/completions",
      model: "deepseek-chat",
    });

    await provider.generateDraft(ctx());

    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("https://api.deepseek.com/v1/chat/completions");
  });
});
