import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicGrowthAnalysisProvider } from "@/infrastructure/llm/anthropic-growth-analysis-provider";
import type { GrowthAnalysisPageContext, GrowthAnalysisResult } from "@/application/content-enrichment/ports/growth-analysis-port";

function page(pageUrl: string): GrowthAnalysisPageContext {
  return { pageUrl, title: "Bromelain Syrup", h1: null, contentExcerpt: "Detox syrup.", faqCount: 0 };
}

function messagesResponse(text: string): Response {
  return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });
}

function result(): GrowthAnalysisResult {
  return {
    businessUnderstanding: "Sells anti-aging skincare and wellness syrups.",
    contentGapsSummary: "No FAQ on any product page.",
    opportunities: [],
    conversionOpportunities: [],
    missingCompetitorPages: [],
    topPages: [],
    executiveSummary: "Add FAQs first.",
  };
}

describe("AnthropicGrowthAnalysisProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a request with the x-api-key header and parses a JSON object response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(messagesResponse(JSON.stringify(result())));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicGrowthAnalysisProvider({ apiKey: "test-key" });

    const parsed = await provider.generateGrowthAnalysis([page("https://example.com/a")]);

    expect(parsed).toEqual(result());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "x-api-key": "test-key" });
  });

  it("strips a markdown code fence Claude sometimes adds despite instructions", async () => {
    const fenced = "```json\n" + JSON.stringify(result()) + "\n```";
    const fetchMock = vi.fn().mockResolvedValue(messagesResponse(fenced));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicGrowthAnalysisProvider({ apiKey: "test-key" });

    const parsed = await provider.generateGrowthAnalysis([page("https://example.com/a")]);

    expect(parsed).toEqual(result());
  });

  it("throws when the response has no text content block", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicGrowthAnalysisProvider({ apiKey: "test-key" });

    await expect(provider.generateGrowthAnalysis([page("https://example.com/a")])).rejects.toThrow(/message content/);
  });
});
