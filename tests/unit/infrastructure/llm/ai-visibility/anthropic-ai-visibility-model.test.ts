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

  it("suggestProbeTarget parses queries + competitors, tolerating a markdown code fence", async () => {
    const fenced = "```json\n" + JSON.stringify({ queries: ["q1"], competitors: ["Kalshi"] }) + "\n```";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(messageResponse(fenced)));
    const model = new AnthropicAiVisibilityModel({ apiKey: "k" });

    const suggestion = await model.suggestProbeTarget({ brand: "Janus", domain: "janus.vote", pageHints: [] });

    expect(suggestion.queries).toEqual(["q1"]);
    expect(suggestion.competitors).toEqual(["Kalshi"]);
  });

  it("diagnoseVisibilityGap parses the gaps array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(messageResponse(JSON.stringify({ gaps: ["Publish pricing", "Add case studies"] })))
    );
    const model = new AnthropicAiVisibilityModel({ apiKey: "k" });

    const gaps = await model.diagnoseVisibilityGap({
      query: "q",
      brand: "Janus",
      domain: "janus.vote",
      competitors: [],
    });

    expect(gaps).toEqual(["Publish pricing", "Add case studies"]);
  });

  it("generateCitationContent parses the structured draft", async () => {
    const draft = { title: "T", metaDescription: "m", sections: [{ heading: "h", body: "b" }], faqs: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(messageResponse(JSON.stringify(draft))));
    const model = new AnthropicAiVisibilityModel({ apiKey: "k" });

    const result = await model.generateCitationContent({ query: "q", brand: "Janus", domain: "janus.vote", gaps: [] });

    expect(result.title).toBe("T");
    expect(result.sections).toEqual([{ heading: "h", body: "b" }]);
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })));
    await expect(new AnthropicAiVisibilityModel({ apiKey: "k" }).ask("q")).rejects.toThrow(/429/);
  });

  it("aborts and throws a timeout error when the request hangs past timeoutMs", async () => {
    const hangingFetch = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        })
    );
    vi.stubGlobal("fetch", hangingFetch);
    const model = new AnthropicAiVisibilityModel({ apiKey: "k", timeoutMs: 10 });

    await expect(model.ask("q")).rejects.toThrow(/timed out after 10ms/);
  });
});
