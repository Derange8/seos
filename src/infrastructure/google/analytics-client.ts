import {
  AnalyticsApiError,
  type AnalyticsClientPort,
  type DailyAnalytics,
} from "@/application/tracking/ports/analytics-client-port";
import { err, ok, type Result } from "@/shared/result";

const ORGANIC_CHANNEL_GROUP = "Organic Search";

interface RunReportResponse {
  rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
}

// GA4's date dimension is YYYYMMDD with no separators — convert to
// YYYY-MM-DD so it's directly comparable with Search Console's date
// format and storable as a plain ISO date string.
function toIsoDate(ga4Date: string): string {
  return `${ga4Date.slice(0, 4)}-${ga4Date.slice(4, 6)}-${ga4Date.slice(6, 8)}`;
}

export class AnalyticsClient implements AnalyticsClientPort {
  async fetchDailyOrganicTraffic(
    accessToken: string,
    propertyId: string,
    startDate: string,
    endDate: string
  ): Promise<Result<DailyAnalytics[], AnalyticsApiError>> {
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          // Breaking down by channel group in one call (rather than a
          // separate filtered request) lets us pick out just the Organic
          // Search row per date without a second round trip.
          dimensions: [{ name: "date" }, { name: "sessionDefaultChannelGroup" }],
          metrics: [{ name: "sessions" }, { name: "conversions" }],
        }),
      });
    } catch (error) {
      return err(new AnalyticsApiError(`Could not reach the Analytics Data API: ${String(error)}`));
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return err(new AnalyticsApiError(`Analytics Data API request failed (${response.status}): ${text}`));
    }

    const data = (await response.json()) as RunReportResponse;
    const byDate = new Map<string, DailyAnalytics>();

    for (const row of data.rows ?? []) {
      const [rawDate, channelGroup] = row.dimensionValues.map((value) => value.value);
      if (channelGroup !== ORGANIC_CHANNEL_GROUP) continue;

      const date = toIsoDate(rawDate);
      byDate.set(date, {
        date,
        organicSessions: Number(row.metricValues[0]?.value ?? 0),
        conversions: Number(row.metricValues[1]?.value ?? 0),
      });
    }

    return ok([...byDate.values()]);
  }
}
