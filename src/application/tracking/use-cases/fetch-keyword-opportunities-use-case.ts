import { KeywordOpportunity } from "@/domain/tracking/entities/keyword-opportunity";
import { PagePerformance } from "@/domain/tracking/entities/page-performance";
import type { GoogleOAuthPort, GoogleOAuthError } from "@/application/tracking/ports/google-oauth-port";
import type { PageQueryPerformance, SearchConsoleApiError, SearchConsoleClientPort } from "@/application/tracking/ports/search-console-client-port";
import type { GoogleConnectionRepositoryPort } from "@/application/tracking/ports/google-connection-repository-port";
import type { KeywordOpportunityRepositoryPort } from "@/application/tracking/ports/keyword-opportunity-repository-port";
import type { PagePerformanceRepositoryPort } from "@/application/tracking/ports/page-performance-repository-port";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class GoogleNotConnectedError extends DomainError {
  readonly code = "GOOGLE_NOT_CONNECTED";
}

export class GscSiteNotConfiguredError extends DomainError {
  readonly code = "GSC_SITE_NOT_CONFIGURED";
}

export interface FetchKeywordOpportunitiesDeps {
  googleOAuth: GoogleOAuthPort;
  searchConsoleClient: SearchConsoleClientPort;
  googleConnectionRepository: GoogleConnectionRepositoryPort;
  keywordOpportunityRepository: KeywordOpportunityRepositoryPort;
  pagePerformanceRepository: PagePerformanceRepositoryPort;
}

// Aggregates the same raw per-(page, query) rows across ALL queries for a
// page, before KeywordOpportunity's "striking distance" filter is applied —
// this is what makes PagePerformance an honest, unfiltered per-page total
// rather than inheriting that filter's blind spot for already-ranking pages.
function aggregateByPage(rows: readonly PageQueryPerformance[], projectId: string): PagePerformance[] {
  const byPage = new Map<string, { clicks: number; impressions: number; weightedPosition: number }>();

  for (const row of rows) {
    const existing = byPage.get(row.page) ?? { clicks: 0, impressions: 0, weightedPosition: 0 };
    byPage.set(row.page, {
      clicks: existing.clicks + row.clicks,
      impressions: existing.impressions + row.impressions,
      weightedPosition: existing.weightedPosition + row.position * row.impressions,
    });
  }

  return Array.from(byPage.entries()).map(([pageUrl, totals]) => {
    const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
    const position = totals.impressions > 0 ? totals.weightedPosition / totals.impressions : 0;
    return PagePerformance.create(projectId, pageUrl, totals.clicks, totals.impressions, ctr, position);
  });
}

// Same reporting-lag/window reasoning as FetchSearchPerformanceUseCase.
const REPORTING_LAG_DAYS = 3;
const WINDOW_DAYS = 30;

// "Striking distance": a page already on Google's radar for a query
// (positions 5-20) represents the highest-ROI content target — relevance
// is already established, so a content improvement is more likely to
// push it onto page 1 than targeting a brand-new keyword from zero.
// MIN_IMPRESSIONS cuts noise from near-zero-volume queries that aren't
// worth anyone's time improving content for.
const MIN_POSITION = 5;
const MAX_POSITION = 20;
const MIN_IMPRESSIONS = 10;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class FetchKeywordOpportunitiesUseCase {
  constructor(private readonly deps: FetchKeywordOpportunitiesDeps) {}

  async execute(
    projectId: string
  ): Promise<Result<KeywordOpportunity[], GoogleNotConnectedError | GscSiteNotConfiguredError | GoogleOAuthError | SearchConsoleApiError>> {
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

    const performanceResult = await this.deps.searchConsoleClient.fetchPageQueryPerformance(
      tokenResult.value.accessToken,
      connection.gscSiteUrl,
      isoDate(startDate),
      isoDate(endDate)
    );
    if (!performanceResult.ok) return performanceResult;

    const opportunities = performanceResult.value
      .filter(
        (row) =>
          row.position >= MIN_POSITION && row.position <= MAX_POSITION && row.impressions >= MIN_IMPRESSIONS
      )
      .map((row) =>
        KeywordOpportunity.create(projectId, row.page, row.query, row.clicks, row.impressions, row.ctr, row.position)
      );

    await this.deps.keywordOpportunityRepository.saveMany(opportunities);
    await this.deps.pagePerformanceRepository.saveMany(aggregateByPage(performanceResult.value, projectId));
    return ok(opportunities);
  }
}
