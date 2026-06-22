import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicRecommendationProvider } from "@/infrastructure/llm/anthropic-recommendation-provider";
import type { AuditIssueRecommendationContext } from "@/application/auditing/ports/llm-port";

function issue(issueId: string, ruleId = "missing-title"): AuditIssueRecommendationContext {
  return { issueId, ruleId, category: "technical", severity: "CRITICAL", message: "no title" };
}

function messagesResponse(text: string): Response {
  return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });
}

describe("AnthropicRecommendationProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty map without calling the API for an empty issue list", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicRecommendationProvider({ apiKey: "test-key" });

    const result = await provider.generateRecommendations([]);

    expect(result.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a request with the x-api-key header and parses recommendations keyed by issueId", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(messagesResponse(JSON.stringify({ "issue-1": "Add a title.", "issue-2": "Add a meta description." })));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicRecommendationProvider({ apiKey: "test-key" });

    const result = await provider.generateRecommendations([issue("issue-1"), issue("issue-2")]);

    expect(result.get("issue-1")).toBe("Add a title.");
    expect(result.get("issue-2")).toBe("Add a meta description.");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "x-api-key": "test-key", "anthropic-version": "2023-06-01" });
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("claude-3-5-haiku-latest");
    expect(body.system).toMatch(/SEO expert/);
  });

  it("uses the model passed in options instead of the default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(messagesResponse(JSON.stringify({})));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicRecommendationProvider({ apiKey: "test-key", model: "claude-opus-4" });

    await provider.generateRecommendations([issue("issue-1")]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("claude-opus-4");
  });

  it("strips a markdown code fence Claude sometimes wraps the JSON in", async () => {
    const fetchMock = vi.fn().mockResolvedValue(messagesResponse('```json\n{"issue-1": "Add a title."}\n```'));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicRecommendationProvider({ apiKey: "test-key" });

    const result = await provider.generateRecommendations([issue("issue-1")]);

    expect(result.get("issue-1")).toBe("Add a title.");
  });

  it("drops a non-string value for one issue rather than failing the whole batch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(messagesResponse(JSON.stringify({ "issue-1": "Add a title.", "issue-2": 42 })));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicRecommendationProvider({ apiKey: "test-key" });

    const result = await provider.generateRecommendations([issue("issue-1"), issue("issue-2")]);

    expect(result.get("issue-1")).toBe("Add a title.");
    expect(result.has("issue-2")).toBe(false);
  });

  it("throws when the API responds with a non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicRecommendationProvider({ apiKey: "test-key" });

    await expect(provider.generateRecommendations([issue("issue-1")])).rejects.toThrow(/429/);
  });

  it("throws when the response has no text content block", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicRecommendationProvider({ apiKey: "test-key" });

    await expect(provider.generateRecommendations([issue("issue-1")])).rejects.toThrow(/message content/);
  });

  it("throws when the message content is not valid JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(messagesResponse("not json"));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicRecommendationProvider({ apiKey: "test-key" });

    await expect(provider.generateRecommendations([issue("issue-1")])).rejects.toThrow(/valid JSON/);
  });
});
