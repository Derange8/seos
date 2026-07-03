import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/openai-ai-visibility-model";

function chatResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

describe("OpenAiAiVisibilityModel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ask sends the query as a user message at a warm temperature", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse("Polymarket is popular."));
    vi.stubGlobal("fetch", fetchMock);
    const model = new OpenAiAiVisibilityModel({ apiKey: "test-key" });

    const answer = await model.ask("best prediction market?");

    expect(answer).toBe("Polymarket is popular.");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ authorization: "Bearer test-key" });
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages).toEqual([{ role: "user", content: "best prediction market?" }]);
    expect(body.temperature).toBeGreaterThan(0);
  });

  it("namesSpecificOption is true on a 'yes' verdict and false otherwise, judged at temperature 0", async () => {
    const yes = vi.fn().mockResolvedValue(chatResponse("Yes"));
    vi.stubGlobal("fetch", yes);
    expect(await new OpenAiAiVisibilityModel({ apiKey: "k" }).namesSpecificOption("Use Polymarket")).toBe(true);

    const no = vi.fn().mockResolvedValue(chatResponse("no"));
    vi.stubGlobal("fetch", no);
    expect(await new OpenAiAiVisibilityModel({ apiKey: "k" }).namesSpecificOption("generic answer")).toBe(false);
    const body = JSON.parse((no.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.temperature).toBe(0);
  });

  it("uses a custom model and baseUrl (DeepSeek-compatible path)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse("x"));
    vi.stubGlobal("fetch", fetchMock);
    const model = new OpenAiAiVisibilityModel({
      apiKey: "k",
      model: "deepseek-chat",
      baseUrl: "https://api.deepseek.com/v1/chat/completions",
    });

    await model.ask("q");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(JSON.parse(init.body as string).model).toBe("deepseek-chat");
  });

  it("suggestProbeTarget requests JSON mode and parses queries + competitors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(chatResponse(JSON.stringify({ queries: ["q1", "q2"], competitors: ["Polymarket"] })));
    vi.stubGlobal("fetch", fetchMock);
    const model = new OpenAiAiVisibilityModel({ apiKey: "k" });

    const suggestion = await model.suggestProbeTarget({ brand: "Janus", domain: "janus.vote", pageHints: ["Home"] });

    expect(suggestion.queries).toEqual(["q1", "q2"]);
    expect(suggestion.competitors).toEqual(["Polymarket"]);
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("diagnoseVisibilityGap parses the gaps array in JSON mode", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(chatResponse(JSON.stringify({ gaps: ["Add a comparison page", "Get third-party reviews"] })));
    vi.stubGlobal("fetch", fetchMock);
    const model = new OpenAiAiVisibilityModel({ apiKey: "k" });

    const gaps = await model.diagnoseVisibilityGap({
      query: "best prediction market",
      brand: "Janus",
      domain: "janus.vote",
      competitors: ["Polymarket"],
    });

    expect(gaps).toEqual(["Add a comparison page", "Get third-party reviews"]);
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 401 })));
    await expect(new OpenAiAiVisibilityModel({ apiKey: "k" }).ask("q")).rejects.toThrow(/401/);
  });

  it("throws when the response has no message content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 })));
    await expect(new OpenAiAiVisibilityModel({ apiKey: "k" }).ask("q")).rejects.toThrow(/message content/);
  });
});
