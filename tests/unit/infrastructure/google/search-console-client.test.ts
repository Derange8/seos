import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchConsoleClient } from "@/infrastructure/google/search-console-client";

describe("SearchConsoleClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists site urls from the siteEntry array", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ siteEntry: [{ siteUrl: "sc-domain:example.com" }, { siteUrl: "https://example.org/" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new SearchConsoleClient();

    const result = await client.listSites("token");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(["sc-domain:example.com", "https://example.org/"]);
    }
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ authorization: "Bearer token" });
  });

  it("returns an empty list when siteEntry is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new SearchConsoleClient();

    const result = await client.listSites("token");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it("fetches daily performance rows, mapping keys[0] to date", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ rows: [{ keys: ["2026-06-01"], clicks: 10, impressions: 100, ctr: 0.1, position: 5.2 }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new SearchConsoleClient();

    const result = await client.fetchDailyPerformance("token", "sc-domain:example.com", "2026-06-01", "2026-06-01");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([{ date: "2026-06-01", clicks: 10, impressions: 100, ctr: 0.1, position: 5.2 }]);
    }
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain(encodeURIComponent("sc-domain:example.com"));
  });

  it("returns an empty array when rows is absent (no data for the range)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new SearchConsoleClient();

    const result = await client.fetchDailyPerformance("token", "sc-domain:example.com", "2026-06-01", "2026-06-01");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it("returns an error on a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new SearchConsoleClient();

    const result = await client.listSites("bad-token");

    expect(result.ok).toBe(false);
  });
});
