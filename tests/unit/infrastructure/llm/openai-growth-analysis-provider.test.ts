import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiGrowthAnalysisProvider, parseGrowthAnalysisResult } from "@/infrastructure/llm/openai-growth-analysis-provider";
import type { GrowthAnalysisPageContext, GrowthAnalysisResult } from "@/application/content-enrichment/ports/growth-analysis-port";

function page(pageUrl: string): GrowthAnalysisPageContext {
  return { pageUrl, title: "Bromelain Syrup", h1: null, contentExcerpt: "Detox syrup.", faqCount: 0 };
}

function chatCompletionResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

function result(): GrowthAnalysisResult {
  return {
    businessUnderstanding: "Sells anti-aging skincare and wellness syrups.",
    contentGapsSummary: "No FAQ on any product page.",
    opportunities: [
      {
        title: "What Does Bromelain Do?",
        searchIntent: "Informational",
        whyUsersSearch: "Page asks but never answers.",
        whyRevenue: "Links to the product page.",
        suggestedSlug: "/blog/what-does-bromelain-do",
        pageType: "BLOG_ARTICLE",
        priority: "HIGH",
      },
    ],
    conversionOpportunities: [{ pageUrl: "https://example.com/a", recommendation: "Add FAQ." }],
    missingCompetitorPages: ["Reviews page"],
    topPages: ["FAQ for bromelain"],
    executiveSummary: "Add FAQs first.",
  };
}

describe("parseGrowthAnalysisResult", () => {
  it("parses a well-formed JSON object", () => {
    expect(parseGrowthAnalysisResult(JSON.stringify(result()))).toEqual(result());
  });

  it("strips a markdown code fence before parsing", () => {
    const fenced = "```json\n" + JSON.stringify(result()) + "\n```";
    expect(parseGrowthAnalysisResult(fenced)).toEqual(result());
  });

  it("drops an invalid opportunity entry rather than failing the whole parse", () => {
    const malformed = { ...result(), opportunities: [...result().opportunities, { title: "incomplete" }] };
    const parsed = parseGrowthAnalysisResult(JSON.stringify(malformed));
    expect(parsed.opportunities).toHaveLength(1);
  });

  it("falls back to empty values for missing fields rather than throwing", () => {
    const parsed = parseGrowthAnalysisResult(JSON.stringify({}));
    expect(parsed).toEqual({
      businessUnderstanding: "",
      contentGapsSummary: "",
      opportunities: [],
      conversionOpportunities: [],
      missingCompetitorPages: [],
      topPages: [],
      executiveSummary: "",
    });
  });

  it("throws when the content is not valid JSON", () => {
    expect(() => parseGrowthAnalysisResult("not json")).toThrow(/valid JSON/);
  });

  it("throws when the content is null", () => {
    expect(() => parseGrowthAnalysisResult("null")).toThrow(/JSON object/);
  });
});

describe("OpenAiGrowthAnalysisProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a request and parses the growth analysis result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatCompletionResponse(JSON.stringify(result())));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiGrowthAnalysisProvider({ apiKey: "test-key" });

    const parsed = await provider.generateGrowthAnalysis([page("https://example.com/a")]);

    expect(parsed).toEqual(result());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ authorization: "Bearer test-key" });
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("throws when the API responds with a non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiGrowthAnalysisProvider({ apiKey: "test-key" });

    await expect(provider.generateGrowthAnalysis([page("https://example.com/a")])).rejects.toThrow(/429/);
  });

  it("uses a custom baseUrl when given, for OpenAI-compatible providers like DeepSeek", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatCompletionResponse(JSON.stringify(result())));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiGrowthAnalysisProvider({
      apiKey: "test-key",
      baseUrl: "https://api.deepseek.com/v1/chat/completions",
      model: "deepseek-chat",
    });

    await provider.generateGrowthAnalysis([page("https://example.com/a")]);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
  });
});
