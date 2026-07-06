import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/gemini-ai-visibility-model";

// Shapes taken from a REAL gemini-2.5-flash generateContent response.
function textResponse(text: string): Response {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
}

describe("GeminiAiVisibilityModel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("engineId is gemini", async () => {
    expect(await new GeminiAiVisibilityModel({ apiKey: "k" }).engineId()).toBe("gemini");
  });

  it("ask posts to generateContent with x-goog-api-key and joins text parts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Poly" }, { text: "market" }] } }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const model = new GeminiAiVisibilityModel({ apiKey: "test-key" });

    const result = await model.ask("best market?", "parametric");

    expect(result.answer).toBe("Polymarket");
    expect(result.groundingMode).toBe("parametric");
    expect(result.citations).toEqual([]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect(init.headers).toMatchObject({ "x-goog-api-key": "test-key" });
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0].text).toBe("best market?");
    expect(body.tools).toBeUndefined(); // parametric → no grounding tool
  });

  it("web_grounded ask enables google_search and extracts the REAL domain from web.title (not the redirect uri)", async () => {
    // Real Gemini grounding: web.uri is always a vertexaisearch redirect proxy;
    // the real domain is in web.title. The adapter must surface title as the
    // citation url so citesDomain() can match it.
    const grounded = new Response(
      JSON.stringify({
        candidates: [
          {
            content: { parts: [{ text: "Janus and Polymarket are options." }] },
            groundingMetadata: {
              groundingChunks: [
                { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AAA", title: "janus.vote" } },
                { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/BBB", title: "polymarket.com" } },
                { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/CCC", title: "janus.vote" } }, // dup title
              ],
            },
          },
        ],
      }),
      { status: 200 }
    );
    const fetchMock = vi.fn().mockResolvedValue(grounded);
    vi.stubGlobal("fetch", fetchMock);
    const model = new GeminiAiVisibilityModel({ apiKey: "k" });

    const result = await model.ask("best prediction market?", "web_grounded");

    expect(result.groundingMode).toBe("web_grounded");
    // url is the real domain (from title), redirect uri is dropped, dup de-duped.
    expect(result.citations).toEqual([
      { url: "janus.vote", title: "janus.vote" },
      { url: "polymarket.com", title: "polymarket.com" },
    ]);
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.tools).toEqual([{ google_search: {} }]);
  });

  it("suggestProbeTarget uses JSON mode (responseMimeType) and parses the result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(textResponse(JSON.stringify({ queries: ["q1"], competitors: ["Polymarket"] })));
    vi.stubGlobal("fetch", fetchMock);
    const model = new GeminiAiVisibilityModel({ apiKey: "k" });

    const suggestion = await model.suggestProbeTarget({ brand: "Janus", domain: "janus.vote", pageHints: [] });

    expect(suggestion.queries).toEqual(["q1"]);
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.systemInstruction).toBeDefined();
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("quota", { status: 429 })));
    await expect(new GeminiAiVisibilityModel({ apiKey: "k" }).ask("q", "parametric")).rejects.toThrow(/429/);
  });

  it("throws when the response has no text content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [] }), { status: 200 })));
    await expect(new GeminiAiVisibilityModel({ apiKey: "k" }).ask("q", "parametric")).rejects.toThrow(/message content/);
  });
});
