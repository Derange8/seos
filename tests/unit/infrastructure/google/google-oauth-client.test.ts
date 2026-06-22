import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleOAuthClient } from "@/infrastructure/google/google-oauth-client";

describe("GoogleOAuthClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds an authorization url with the readonly scopes, offline access, and forced consent", () => {
    const client = new GoogleOAuthClient("client-id", "client-secret");
    const url = new URL(client.buildAuthorizationUrl("http://127.0.0.1:51789/callback", "state-123"));

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:51789/callback");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("scope")).toContain("webmasters.readonly");
    expect(url.searchParams.get("scope")).toContain("analytics.readonly");
  });

  it("exchanges a code for tokens with the authorization_code grant", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 3600 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GoogleOAuthClient("client-id", "client-secret");

    const result = await client.exchangeCodeForTokens("code-123", "http://127.0.0.1:51789/callback");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ accessToken: "at", refreshToken: "rt", expiresInSeconds: 3600 });
    }
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("code-123");
  });

  it("refreshes an access token with the refresh_token grant and no refresh token in the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "at2", expires_in: 1800 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GoogleOAuthClient("client-id", "client-secret");

    const result = await client.refreshAccessToken("rt");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ accessToken: "at2", refreshToken: null, expiresInSeconds: 1800 });
    }
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
  });

  it("returns an error when the token endpoint responds non-ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("invalid_grant", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GoogleOAuthClient("client-id", "client-secret");

    const result = await client.refreshAccessToken("bad-token");

    expect(result.ok).toBe(false);
  });

  it("returns an error when the network request itself fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GoogleOAuthClient("client-id", "client-secret");

    const result = await client.exchangeCodeForTokens("code", "http://127.0.0.1:51789/callback");

    expect(result.ok).toBe(false);
  });
});
