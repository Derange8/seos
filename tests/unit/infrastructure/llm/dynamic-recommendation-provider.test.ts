import { afterEach, describe, expect, it, vi } from "vitest";
import { DynamicRecommendationProvider } from "@/infrastructure/llm/dynamic-recommendation-provider";
import { LlmSettings } from "@/domain/settings/entities/llm-settings";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import type { AuditIssueRecommendationContext } from "@/application/auditing/ports/llm-port";
import type { Logger } from "@/shared/logger";

function issue(issueId: string): AuditIssueRecommendationContext {
  return { issueId, ruleId: "missing-title", category: "technical", severity: "CRITICAL", message: "no title" };
}

const noopLogger: Logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

function repositoryReturning(settings: LlmSettings | null): LlmSettingsRepositoryPort {
  return {
    find: vi.fn().mockResolvedValue(settings),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

describe("DynamicRecommendationProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to StaticRecommendationProvider when nothing is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DynamicRecommendationProvider(repositoryReturning(null), noopLogger);

    const result = await provider.generateRecommendations([issue("issue-1")]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.get("issue-1")).toBeTypeOf("string");
  });

  it("re-reads settings on every call rather than caching the provider at construction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const repository = repositoryReturning(null);
    const provider = new DynamicRecommendationProvider(repository, noopLogger);

    await provider.generateRecommendations([issue("issue-1")]);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.mocked(repository.find).mockResolvedValue(LlmSettings.create("openai", "sk-key", null));
    await provider.generateRecommendations([issue("issue-1")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("dispatches to OpenAiRecommendationProvider with the configured baseUrl for deepseek", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DynamicRecommendationProvider(
      repositoryReturning(LlmSettings.create("deepseek", "ds-key", null)),
      noopLogger
    );

    await provider.generateRecommendations([issue("issue-1")]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ authorization: "Bearer ds-key" });
  });

  it("dispatches to AnthropicRecommendationProvider for anthropic", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text: "{}" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new DynamicRecommendationProvider(
      repositoryReturning(LlmSettings.create("anthropic", "claude-key", null)),
      noopLogger
    );

    await provider.generateRecommendations([issue("issue-1")]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "x-api-key": "claude-key" });
  });
});
