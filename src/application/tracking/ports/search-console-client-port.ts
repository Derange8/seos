import { DomainError } from "@/shared/domain-error";
import type { Result } from "@/shared/result";

export class SearchConsoleApiError extends DomainError {
  readonly code = "SEARCH_CONSOLE_API_ERROR";
}

export interface DailySearchPerformance {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PageQueryPerformance {
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleClientPort {
  // Sites the authenticated Google account already has verified access
  // to in Search Console — Seos doesn't redo domain verification itself,
  // it only lists what's already there.
  listSites(accessToken: string): Promise<Result<string[], SearchConsoleApiError>>;
  fetchDailyPerformance(
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string
  ): Promise<Result<DailySearchPerformance[], SearchConsoleApiError>>;
  // Per (page, query) rows, not site-wide totals — this is what lets Seos
  // find a *specific* page stuck at a *specific* query's position, instead
  // of just knowing the site's average position moved.
  fetchPageQueryPerformance(
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string
  ): Promise<Result<PageQueryPerformance[], SearchConsoleApiError>>;
}
