import { afterEach, describe, expect, it, vi } from "vitest";
import { DynamicPageContentDraftProvider } from "@/infrastructure/llm/dynamic-page-content-draft-provider";
import { NoLlmProviderConfiguredError } from "@/application/content-enrichment/ports/page-content-draft-port";
import { LlmSettings } from "@/domain/settings/entities/llm-settings";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import type { PageContentDraftContext } from "@/application/content-enrichment/ports/page-content-draft-port";

function ctx(): PageContentDraftContext {
  return { pageUrl: "https://example.com/p", title: "Bromelain", h1: null, contentExcerpt: "x", existingFaqCount: 0 };
}

function result() {
  return { suggestedTitle: "T", suggestedMetaDescription: "M", bodySections: [], faqs: [] };
}

function repositoryReturning(settings: LlmSettings | null): LlmSettingsRepositoryPort {
  return {
    find: vi.fn().mockResolvedValue(settings),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

describe("DynamicPageContentDraftProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws NoLlmProviderConfiguredError when nothing is configured — there's no static fallback", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DynamicPageContentDraftProvider(repositoryReturning(null));

    await expect(provider.generateDraft(ctx())).rejects.toBeInstanceOf(NoLlmProviderConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches to OpenAiPageContentDraftProvider with the configured baseUrl for deepseek", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result()) } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DynamicPageContentDraftProvider(repositoryReturning(LlmSettings.create("deepseek", "ds-key", null)));

    await provider.generateDraft(ctx());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ authorization: "Bearer ds-key" });
  });

  it("dispatches to AnthropicPageContentDraftProvider for anthropic", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(result()) }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DynamicPageContentDraftProvider(repositoryReturning(LlmSettings.create("anthropic", "claude-key", null)));

    await provider.generateDraft(ctx());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "x-api-key": "claude-key" });
  });

  it("dispatches to OpenAiPageContentDraftProvider for openai", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result()) } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DynamicPageContentDraftProvider(repositoryReturning(LlmSettings.create("openai", "oa-key", null)));

    await provider.generateDraft(ctx());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ authorization: "Bearer oa-key" });
  });
});
