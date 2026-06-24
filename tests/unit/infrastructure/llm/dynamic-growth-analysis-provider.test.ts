import { afterEach, describe, expect, it, vi } from "vitest";
import { DynamicGrowthAnalysisProvider } from "@/infrastructure/llm/dynamic-growth-analysis-provider";
import { NoLlmProviderConfiguredError } from "@/application/content-enrichment/ports/growth-analysis-port";
import { LlmSettings } from "@/domain/settings/entities/llm-settings";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import type { GrowthAnalysisPageContext } from "@/application/content-enrichment/ports/growth-analysis-port";

function page(): GrowthAnalysisPageContext {
  return { pageUrl: "https://example.com/a", title: "Bromelain Syrup", h1: null, contentExcerpt: null, faqCount: 0 };
}

function repositoryReturning(settings: LlmSettings | null): LlmSettingsRepositoryPort {
  return {
    find: vi.fn().mockResolvedValue(settings),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

describe("DynamicGrowthAnalysisProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws NoLlmProviderConfiguredError when nothing is configured — there's no static fallback", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DynamicGrowthAnalysisProvider(repositoryReturning(null));

    await expect(provider.generateGrowthAnalysis([page()])).rejects.toBeInstanceOf(NoLlmProviderConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches to OpenAiGrowthAnalysisProvider with the configured baseUrl for deepseek", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DynamicGrowthAnalysisProvider(repositoryReturning(LlmSettings.create("deepseek", "ds-key", null)));

    await provider.generateGrowthAnalysis([page()]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ authorization: "Bearer ds-key" });
  });

  it("dispatches to AnthropicGrowthAnalysisProvider for anthropic", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text: "{}" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DynamicGrowthAnalysisProvider(repositoryReturning(LlmSettings.create("anthropic", "claude-key", null)));

    await provider.generateGrowthAnalysis([page()]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "x-api-key": "claude-key" });
  });
});
