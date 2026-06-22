import { DomainError } from "@/shared/domain-error";
import type { Result } from "@/shared/result";

export class AnalyticsApiError extends DomainError {
  readonly code = "ANALYTICS_API_ERROR";
}

export interface DailyAnalytics {
  date: string;
  organicSessions: number;
  conversions: number;
}

export interface AnalyticsClientPort {
  fetchDailyOrganicTraffic(
    accessToken: string,
    propertyId: string,
    startDate: string,
    endDate: string
  ): Promise<Result<DailyAnalytics[], AnalyticsApiError>>;
}
