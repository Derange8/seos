import { AnalyticsSnapshot } from "@/domain/tracking/entities/analytics-snapshot";
import type { GoogleOAuthPort, GoogleOAuthError } from "@/application/tracking/ports/google-oauth-port";
import type { AnalyticsApiError, AnalyticsClientPort } from "@/application/tracking/ports/analytics-client-port";
import type { GoogleConnectionRepositoryPort } from "@/application/tracking/ports/google-connection-repository-port";
import type { AnalyticsSnapshotRepositoryPort } from "@/application/tracking/ports/analytics-snapshot-repository-port";
import { GoogleNotConnectedError } from "@/application/tracking/use-cases/fetch-search-performance-use-case";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class Ga4PropertyNotConfiguredError extends DomainError {
  readonly code = "GA4_PROPERTY_NOT_CONFIGURED";
}

export interface FetchAnalyticsDeps {
  googleOAuth: GoogleOAuthPort;
  analyticsClient: AnalyticsClientPort;
  googleConnectionRepository: GoogleConnectionRepositoryPort;
  analyticsSnapshotRepository: AnalyticsSnapshotRepositoryPort;
}

const WINDOW_DAYS = 30;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class FetchAnalyticsUseCase {
  constructor(private readonly deps: FetchAnalyticsDeps) {}

  async execute(
    projectId: string
  ): Promise<Result<AnalyticsSnapshot[], GoogleNotConnectedError | Ga4PropertyNotConfiguredError | GoogleOAuthError | AnalyticsApiError>> {
    const connection = await this.deps.googleConnectionRepository.findByProjectId(projectId);
    if (!connection) {
      return err(new GoogleNotConnectedError("No Google account connected for this project"));
    }
    if (!connection.ga4PropertyId) {
      return err(new Ga4PropertyNotConfiguredError("No GA4 property configured for this project"));
    }

    const tokenResult = await this.deps.googleOAuth.refreshAccessToken(connection.refreshToken);
    if (!tokenResult.ok) return tokenResult;

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - WINDOW_DAYS);

    const trafficResult = await this.deps.analyticsClient.fetchDailyOrganicTraffic(
      tokenResult.value.accessToken,
      connection.ga4PropertyId,
      isoDate(startDate),
      isoDate(endDate)
    );
    if (!trafficResult.ok) return trafficResult;

    const snapshots = trafficResult.value.map((row) =>
      AnalyticsSnapshot.create(projectId, new Date(row.date), row.organicSessions, row.conversions)
    );
    await this.deps.analyticsSnapshotRepository.saveMany(snapshots);
    return ok(snapshots);
  }
}
