import {
  SearchConsoleApiError,
  type DailySearchPerformance,
  type PageQueryPerformance,
  type SearchConsoleClientPort,
} from "@/application/tracking/ports/search-console-client-port";
import { err, ok, type Result } from "@/shared/result";

const SITES_URL = "https://www.googleapis.com/webmasters/v3/sites";
// GSC's API max is 25000; 5000 is plenty for any single site's
// page+query breakdown without inflating fetch/storage cost.
const PAGE_QUERY_ROW_LIMIT = 5000;

interface SitesListResponse {
  siteEntry?: { siteUrl: string }[];
}

interface SearchAnalyticsQueryResponse {
  rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
}

export class SearchConsoleClient implements SearchConsoleClientPort {
  async listSites(accessToken: string): Promise<Result<string[], SearchConsoleApiError>> {
    const result = await this.request<SitesListResponse>(SITES_URL, accessToken);
    if (!result.ok) return result;
    return ok((result.value.siteEntry ?? []).map((entry) => entry.siteUrl));
  }

  async fetchDailyPerformance(
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string
  ): Promise<Result<DailySearchPerformance[], SearchConsoleApiError>> {
    const url = `${SITES_URL}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    const result = await this.request<SearchAnalyticsQueryResponse>(url, accessToken, {
      method: "POST",
      body: JSON.stringify({ startDate, endDate, dimensions: ["date"], rowLimit: 1000 }),
    });
    if (!result.ok) return result;

    const rows = (result.value.rows ?? []).map((row) => ({
      date: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));
    return ok(rows);
  }

  async fetchPageQueryPerformance(
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string
  ): Promise<Result<PageQueryPerformance[], SearchConsoleApiError>> {
    const url = `${SITES_URL}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    const result = await this.request<SearchAnalyticsQueryResponse>(url, accessToken, {
      method: "POST",
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ["page", "query"],
        rowLimit: PAGE_QUERY_ROW_LIMIT,
      }),
    });
    if (!result.ok) return result;

    const rows = (result.value.rows ?? []).map((row) => ({
      page: row.keys[0],
      query: row.keys[1],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));
    return ok(rows);
  }

  private async request<T>(url: string, accessToken: string, init: RequestInit = {}): Promise<Result<T, SearchConsoleApiError>> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          authorization: `Bearer ${accessToken}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
        },
      });
    } catch (error) {
      return err(new SearchConsoleApiError(`Could not reach the Search Console API: ${String(error)}`));
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return err(new SearchConsoleApiError(`Search Console API request failed (${response.status}): ${text}`));
    }

    return ok((await response.json()) as T);
  }
}
