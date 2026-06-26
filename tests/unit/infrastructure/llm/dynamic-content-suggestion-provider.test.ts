import { afterEach, describe, expect, it, vi } from "vitest";
import { DynamicContentSuggestionProvider } from "@/infrastructure/llm/dynamic-content-suggestion-provider";
import { NoLlmProviderConfiguredError } from "@/application/content-enrichment/ports/content-enrichment-port";
import { LlmSettings } from "@/domain/settings/entities/llm-settings";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import type { ContentEnrichmentContext } from "@/application/content-enrichment/ports/content-enrichment-port";

function context(): ContentEnrichmentContext {
  return { pageUrl: "https://example.com/a", query: "bromelain syrup benefits", position: 14, impressions: 320 };
}

function repositoryReturning(settings: LlmSettings | null): LlmSettingsRepositoryPort {
  return {
    find: vi.fn().mockResolvedValue(settings),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

describe("DynamicContentSuggestionProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws NoLlmProviderConfiguredError when nothing is configured — there's no static fallback", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DynamicContentSuggestionProvider(repositoryReturning(null));

    await expect(provider.generateSuggestion(context())).rejects.toBeInstanceOf(NoLlmProviderConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches to OpenAiContentSuggestionProvider with the configured baseUrl for deepseek", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Suggestion." } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DynamicContentSuggestionProvider(repositoryReturning(LlmSettings.create("deepseek", "ds-key", null)));

    await provider.generateSuggestion(context());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ authorization: "Bearer ds-key" });
  });

  it("dispatches to AnthropicContentSuggestionProvider for anthropic", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text: "Suggestion." }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DynamicContentSuggestionProvider(repositoryReturning(LlmSettings.create("anthropic", "claude-key", null)));

    await provider.generateSuggestion(context());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "x-api-key": "claude-key" });
  });

  it("dispatches to OpenAiContentSuggestionProvider for openai", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Suggestion." } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DynamicContentSuggestionProvider(repositoryReturning(LlmSettings.create("openai", "oa-key", null)));

    await provider.generateSuggestion(context());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ authorization: "Bearer oa-key" });
  });
});
