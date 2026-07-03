import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/anthropic-ai-visibility-model";

function messageResponse(text: string): Response {
  return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });
}

describe("AnthropicAiVisibilityModel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ask posts to the Messages API with x-api-key and no system prompt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(messageResponse("Polymarket"));
    vi.stubGlobal("fetch", fetchMock);
    const model = new AnthropicAiVisibilityModel({ apiKey: "claude-key" });

    const answer = await model.ask("q");

    expect(answer).toBe("Polymarket");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers).toMatchObject({ "x-api-key": "claude-key", "anthropic-version": "2023-06-01" });
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("claude-3-5-haiku-latest");
    expect(body.messages).toEqual([{ role: "user", content: "q" }]);
    expect(body.system).toBeUndefined();
  });

  it("namesSpecificOption sends a classifier system prompt at temperature 0 and parses the verdict", async () => {
    const fetchMock = vi.fn().mockResolvedValue(messageResponse("No."));
    vi.stubGlobal("fetch", fetchMock);
    const model = new AnthropicAiVisibilityModel({ apiKey: "k" });

    expect(await model.namesSpecificOption("generic answer")).toBe(false);
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.system).toContain("classifier");
    expect(body.temperature).toBe(0);
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));
    await expect(new AnthropicAiVisibilityModel({ apiKey: "k" }).ask("q")).rejects.toThrow(/429/);
  });
});
