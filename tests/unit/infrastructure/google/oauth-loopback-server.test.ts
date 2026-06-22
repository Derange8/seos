import { describe, expect, it, vi } from "vitest";
import { OAuthLoopbackServer } from "@/infrastructure/google/oauth-loopback-server";
import type { Logger } from "@/shared/logger";

const noopLogger: Logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

// A free, unprivileged port unlikely to collide with anything else
// running locally during the test.
function randomTestPort(): number {
  return 50000 + Math.floor(Math.random() * 5000);
}

describe("OAuthLoopbackServer", () => {
  it("resolves with the code and state from a real callback request", async () => {
    const server = new OAuthLoopbackServer(randomTestPort(), noopLogger);
    const { redirectUri, result } = server.start("expected-state");

    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", "auth-code-123");
    callbackUrl.searchParams.set("state", "expected-state");

    const response = await fetch(callbackUrl.toString());
    expect(response.status).toBe(200);

    const callback = await result;
    expect(callback).toEqual({ code: "auth-code-123", state: "expected-state" });
  });

  it("rejects when the state does not match", async () => {
    const server = new OAuthLoopbackServer(randomTestPort(), noopLogger);
    const { redirectUri, result } = server.start("expected-state");
    // Attach the rejection expectation before the request that triggers
    // it — the server rejects synchronously inside the request handler,
    // so awaiting fetch() first would let the rejection fire unobserved
    // for a tick, which Node reports as an unhandled rejection even
    // though the later `await assertion` does still catch it.
    const assertion = expect(result).rejects.toThrow(/state mismatch/);

    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", "auth-code-123");
    callbackUrl.searchParams.set("state", "wrong-state");
    await fetch(callbackUrl.toString());

    await assertion;
  });

  it("rejects when Google reports an error param", async () => {
    const server = new OAuthLoopbackServer(randomTestPort(), noopLogger);
    const { redirectUri, result } = server.start("expected-state");
    const assertion = expect(result).rejects.toThrow(/access_denied/);

    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("error", "access_denied");
    await fetch(callbackUrl.toString());

    await assertion;
  });

  it("rejects on timeout if no callback ever arrives", async () => {
    const server = new OAuthLoopbackServer(randomTestPort(), noopLogger);
    const { result } = server.start("expected-state", 50);

    await expect(result).rejects.toThrow(/Timed out/);
  });
});
