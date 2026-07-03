import { afterEach, describe, expect, it, vi } from "vitest";
import { DynamicAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/dynamic-ai-visibility-model";
import { AiVisibilityProviderNotConfiguredError } from "@/application/ai-visibility/errors";
import { LlmSettings } from "@/domain/settings/entities/llm-settings";
import type { LlmSettingsRepositoryPort } from "@/application/settings/ports/llm-settings-repository-port";
import type { Logger } from "@/shared/logger";

const noopLogger: Logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

function repositoryReturning(settings: LlmSettings | null): LlmSettingsRepositoryPort {
  return {
    find: vi.fn().mockResolvedValue(settings),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

function openAiResponse(): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: "answer" } }] }), { status: 200 });
}

describe("DynamicAiVisibilityModel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws AiVisibilityProviderNotConfiguredError when nothing is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const model = new DynamicAiVisibilityModel(repositoryReturning(null), noopLogger);

    await expect(model.ask("q")).rejects.toBeInstanceOf(AiVisibilityProviderNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches to OpenAI for openai settings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(openAiResponse());
    vi.stubGlobal("fetch", fetchMock);
    const model = new DynamicAiVisibilityModel(repositoryReturning(LlmSettings.create("openai", "sk-key", null)), noopLogger);

    await model.ask("q");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ authorization: "Bearer sk-key" });
  });

  it("dispatches to the DeepSeek base URL for deepseek settings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(openAiResponse());
    vi.stubGlobal("fetch", fetchMock);
    const model = new DynamicAiVisibilityModel(repositoryReturning(LlmSettings.create("deepseek", "ds-key", null)), noopLogger);

    await model.ask("q");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
  });

  it("dispatches to Anthropic for anthropic settings", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text: "answer" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const model = new DynamicAiVisibilityModel(repositoryReturning(LlmSettings.create("anthropic", "claude-key", null)), noopLogger);

    await model.ask("q");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "x-api-key": "claude-key" });
  });

  it("resolves settings once and caches the model for the run's lifetime", async () => {
    // Fresh Response per call — a Response body can only be read once.
    const fetchMock = vi.fn().mockImplementation(async () => openAiResponse());
    vi.stubGlobal("fetch", fetchMock);
    const repository = repositoryReturning(LlmSettings.create("openai", "sk-key", null));
    const model = new DynamicAiVisibilityModel(repository, noopLogger);

    await model.ask("q1");
    await model.ask("q2");

    expect(repository.find).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
