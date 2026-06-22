import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyticsClient } from "@/infrastructure/google/analytics-client";

function reportResponse(rows: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[]): Response {
  return new Response(JSON.stringify({ rows }), { status: 200 });
}

describe("AnalyticsClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps only Organic Search rows and converts GA4's YYYYMMDD date to ISO", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      reportResponse([
        { dimensionValues: [{ value: "20260601" }, { value: "Organic Search" }], metricValues: [{ value: "42" }, { value: "3" }] },
        { dimensionValues: [{ value: "20260601" }, { value: "Direct" }], metricValues: [{ value: "10" }, { value: "0" }] },
      ])
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new AnalyticsClient();

    const result = await client.fetchDailyOrganicTraffic("token", "501234567", "2026-06-01", "2026-06-01");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([{ date: "2026-06-01", organicSessions: 42, conversions: 3 }]);
    }
  });

  it("sends the property id and date range in the request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reportResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    const client = new AnalyticsClient();

    await client.fetchDailyOrganicTraffic("token", "501234567", "2026-06-01", "2026-06-30");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("properties/501234567:runReport");
    const body = JSON.parse(init.body as string);
    expect(body.dateRanges).toEqual([{ startDate: "2026-06-01", endDate: "2026-06-30" }]);
  });

  it("returns an empty array when there are no rows at all", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new AnalyticsClient();

    const result = await client.fetchDailyOrganicTraffic("token", "501234567", "2026-06-01", "2026-06-01");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });

  it("returns an error on a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new AnalyticsClient();

    const result = await client.fetchDailyOrganicTraffic("token", "501234567", "2026-06-01", "2026-06-01");

    expect(result.ok).toBe(false);
  });
});
