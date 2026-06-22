import { afterEach, describe, expect, it, vi } from "vitest";
import { LlmCredentialValidator } from "@/infrastructure/llm/llm-credential-validator";

describe("LlmCredentialValidator", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok when the provider's models endpoint responds 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const validator = new LlmCredentialValidator();

    const result = await validator.validate("openai", "sk-key");

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/models");
    expect(init.headers).toMatchObject({ authorization: "Bearer sk-key" });
  });

  it("uses x-api-key for anthropic instead of a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const validator = new LlmCredentialValidator();

    await validator.validate("anthropic", "anthropic-key");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/models");
    expect(init.headers).toMatchObject({ "x-api-key": "anthropic-key", "anthropic-version": "2023-06-01" });
  });

  it("returns an error for a 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const validator = new LlmCredentialValidator();

    const result = await validator.validate("openai", "bad-key");

    expect(result.ok).toBe(false);
  });

  it("returns an error when the network request itself fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));
    vi.stubGlobal("fetch", fetchMock);
    const validator = new LlmCredentialValidator();

    const result = await validator.validate("deepseek", "key");

    expect(result.ok).toBe(false);
  });
});
