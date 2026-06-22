import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiRecommendationProvider } from "@/infrastructure/llm/openai-recommendation-provider";
import type { AuditIssueRecommendationContext } from "@/application/auditing/ports/llm-port";

function issue(issueId: string, ruleId = "missing-title"): AuditIssueRecommendationContext {
  return { issueId, ruleId, category: "technical", severity: "CRITICAL", message: "no title" };
}

function chatCompletionResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

describe("OpenAiRecommendationProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty map without calling the API for an empty issue list", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiRecommendationProvider({ apiKey: "test-key" });

    const result = await provider.generateRecommendations([]);

    expect(result.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a batched request and parses recommendations keyed by issueId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      chatCompletionResponse(JSON.stringify({ "issue-1": "Add a title.", "issue-2": "Add a meta description." }))
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiRecommendationProvider({ apiKey: "test-key" });

    const result = await provider.generateRecommendations([issue("issue-1"), issue("issue-2")]);

    expect(result.get("issue-1")).toBe("Add a title.");
    expect(result.get("issue-2")).toBe("Add a meta description.");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ authorization: "Bearer test-key" });
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("uses the model passed in options instead of the default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatCompletionResponse(JSON.stringify({})));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiRecommendationProvider({ apiKey: "test-key", model: "gpt-4o" });

    await provider.generateRecommendations([issue("issue-1")]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("gpt-4o");
  });

  it("drops a non-string value for one issue rather than failing the whole batch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(chatCompletionResponse(JSON.stringify({ "issue-1": "Add a title.", "issue-2": 42 })));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiRecommendationProvider({ apiKey: "test-key" });

    const result = await provider.generateRecommendations([issue("issue-1"), issue("issue-2")]);

    expect(result.get("issue-1")).toBe("Add a title.");
    expect(result.has("issue-2")).toBe(false);
  });

  it("throws when the API responds with a non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiRecommendationProvider({ apiKey: "test-key" });

    await expect(provider.generateRecommendations([issue("issue-1")])).rejects.toThrow(/429/);
  });

  it("throws when the response has no message content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiRecommendationProvider({ apiKey: "test-key" });

    await expect(provider.generateRecommendations([issue("issue-1")])).rejects.toThrow(/message content/);
  });

  it("throws when the message content is not valid JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatCompletionResponse("not json"));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiRecommendationProvider({ apiKey: "test-key" });

    await expect(provider.generateRecommendations([issue("issue-1")])).rejects.toThrow(/valid JSON/);
  });

  it("uses a custom baseUrl when given, for OpenAI-compatible providers like DeepSeek", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatCompletionResponse(JSON.stringify({})));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAiRecommendationProvider({
      apiKey: "test-key",
      baseUrl: "https://api.deepseek.com/v1/chat/completions",
      model: "deepseek-chat",
    });

    await provider.generateRecommendations([issue("issue-1")]);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
  });
});
