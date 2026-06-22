import { SearchPerformanceSnapshot } from "@/domain/tracking/entities/search-performance-snapshot";
import type { GoogleOAuthPort, GoogleOAuthError } from "@/application/tracking/ports/google-oauth-port";
import type { SearchConsoleApiError, SearchConsoleClientPort } from "@/application/tracking/ports/search-console-client-port";
import type { GoogleConnectionRepositoryPort } from "@/application/tracking/ports/google-connection-repository-port";
import type { SearchPerformanceRepositoryPort } from "@/application/tracking/ports/search-performance-repository-port";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class GoogleNotConnectedError extends DomainError {
  readonly code = "GOOGLE_NOT_CONNECTED";
}

export class GscSiteNotConfiguredError extends DomainError {
  readonly code = "GSC_SITE_NOT_CONFIGURED";
}

export interface FetchSearchPerformanceDeps {
  googleOAuth: GoogleOAuthPort;
  searchConsoleClient: SearchConsoleClientPort;
  googleConnectionRepository: GoogleConnectionRepositoryPort;
  searchPerformanceRepository: SearchPerformanceRepositoryPort;
}

// Search Console's own data has a 2-3 day reporting lag — querying up to
// "today" would just return zero rows for the most recent days, so the
// window ends 3 days back instead.
const REPORTING_LAG_DAYS = 3;
const WINDOW_DAYS = 30;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class FetchSearchPerformanceUseCase {
  constructor(private readonly deps: FetchSearchPerformanceDeps) {}

  async execute(
    projectId: string
  ): Promise<Result<SearchPerformanceSnapshot[], GoogleNotConnectedError | GscSiteNotConfiguredError | GoogleOAuthError | SearchConsoleApiError>> {
    const connection = await this.deps.googleConnectionRepository.findByProjectId(projectId);
    if (!connection) {
      return err(new GoogleNotConnectedError("No Google account connected for this project"));
    }
    if (!connection.gscSiteUrl) {
      return err(new GscSiteNotConfiguredError("No Search Console property selected for this project"));
    }

    const tokenResult = await this.deps.googleOAuth.refreshAccessToken(connection.refreshToken);
    if (!tokenResult.ok) return tokenResult;

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - REPORTING_LAG_DAYS);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - WINDOW_DAYS);

    const performanceResult = await this.deps.searchConsoleClient.fetchDailyPerformance(
      tokenResult.value.accessToken,
      connection.gscSiteUrl,
      isoDate(startDate),
      isoDate(endDate)
    );
    if (!performanceResult.ok) return performanceResult;

    const snapshots = performanceResult.value.map((row) =>
      SearchPerformanceSnapshot.create(projectId, new Date(row.date), row.clicks, row.impressions, row.ctr, row.position)
    );
    await this.deps.searchPerformanceRepository.saveMany(snapshots);
    return ok(snapshots);
  }
}
