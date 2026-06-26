import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaGoogleConnectionRepository } from "@/infrastructure/persistence/prisma/prisma-google-connection-repository";
import { PrismaSearchPerformanceRepository } from "@/infrastructure/persistence/prisma/prisma-search-performance-repository";
import { PrismaAnalyticsSnapshotRepository } from "@/infrastructure/persistence/prisma/prisma-analytics-snapshot-repository";
import { PrismaKeywordOpportunityRepository } from "@/infrastructure/persistence/prisma/prisma-keyword-opportunity-repository";
import { PrismaKeywordCannibalizationRepository } from "@/infrastructure/persistence/prisma/prisma-keyword-cannibalization-repository";
import { PrismaCtrUnderperformerRepository } from "@/infrastructure/persistence/prisma/prisma-ctr-underperformer-repository";
import { PrismaPagePerformanceRepository } from "@/infrastructure/persistence/prisma/prisma-page-performance-repository";
import { PrismaContentSuggestionRepository } from "@/infrastructure/persistence/prisma/prisma-content-suggestion-repository";
import { SearchConsoleClient } from "@/infrastructure/google/search-console-client";
import { AnalyticsClient } from "@/infrastructure/google/analytics-client";
import { createGoogleOAuthClient } from "@/infrastructure/google/create-google-oauth-client";
import { FetchSearchPerformanceUseCase } from "@/application/tracking/use-cases/fetch-search-performance-use-case";
import { FetchAnalyticsUseCase, Ga4PropertyNotConfiguredError } from "@/application/tracking/use-cases/fetch-analytics-use-case";
import { FetchKeywordOpportunitiesUseCase } from "@/application/tracking/use-cases/fetch-keyword-opportunities-use-case";
import { toSearchPerformanceSnapshotDto, toAnalyticsSnapshotDto, toKeywordOpportunityDto, toKeywordCannibalizationIssueDto, toCtrUnderperformerDto } from "@/application/tracking/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

// GSC and GA4 are independent — a missing GA4 property shouldn't prevent
// Search Console data from refreshing, so each source's success/failure
// is reported separately rather than the whole request failing together.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let oauthClient;
  try {
    oauthClient = createGoogleOAuthClient();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
  const googleConnectionRepository = new PrismaGoogleConnectionRepository(prisma);

  const searchPerformanceResult = await new FetchSearchPerformanceUseCase({
    googleOAuth: oauthClient,
    searchConsoleClient: new SearchConsoleClient(),
    googleConnectionRepository,
    searchPerformanceRepository: new PrismaSearchPerformanceRepository(prisma),
  }).execute(projectId);

  const analyticsResult = await new FetchAnalyticsUseCase({
    googleOAuth: oauthClient,
    analyticsClient: new AnalyticsClient(),
    googleConnectionRepository,
    analyticsSnapshotRepository: new PrismaAnalyticsSnapshotRepository(prisma),
  }).execute(projectId);

  const keywordOpportunitiesResult = await new FetchKeywordOpportunitiesUseCase({
    googleOAuth: oauthClient,
    searchConsoleClient: new SearchConsoleClient(),
    googleConnectionRepository,
    keywordOpportunityRepository: new PrismaKeywordOpportunityRepository(prisma),
    pagePerformanceRepository: new PrismaPagePerformanceRepository(prisma),
    keywordCannibalizationRepository: new PrismaKeywordCannibalizationRepository(prisma),
    ctrUnderperformerRepository: new PrismaCtrUnderperformerRepository(prisma),
  }).execute(projectId);

  // A re-fetched opportunity keeps the same id (upsert by pageUrl+query,
  // see PrismaKeywordOpportunityRepository.saveMany), so a suggestion
  // generated before this refresh is still valid and shouldn't vanish
  // from the response just because the underlying metrics were refreshed.
  const suggestionByOpportunityId = keywordOpportunitiesResult.ok
    ? new Map(
        (await new PrismaContentSuggestionRepository(prisma).findByProjectId(projectId)).map((suggestion) => [
          suggestion.keywordOpportunityId,
          suggestion.content,
        ])
      )
    : new Map<string, string>();

  return NextResponse.json({
    searchPerformance: searchPerformanceResult.ok
      ? { status: "ok", snapshots: searchPerformanceResult.value.map(toSearchPerformanceSnapshotDto) }
      : { status: "error", error: searchPerformanceResult.error.message, code: searchPerformanceResult.error.code },
    analytics: analyticsResult.ok
      ? { status: "ok", snapshots: analyticsResult.value.map(toAnalyticsSnapshotDto) }
      : analyticsResult.error instanceof Ga4PropertyNotConfiguredError
        // Not configuring GA4 is the normal, expected state for a project
        // that only wants Search Console data — not an error worth
        // surfacing as one in the UI the way a real API failure is.
        ? { status: "not_configured" }
        : { status: "error", error: analyticsResult.error.message, code: analyticsResult.error.code },
    keywordOpportunities: keywordOpportunitiesResult.ok
      ? {
          status: "ok",
          opportunities: keywordOpportunitiesResult.value.opportunities.map((opportunity) => ({
            ...toKeywordOpportunityDto(opportunity),
            suggestion: suggestionByOpportunityId.get(opportunity.id) ?? null,
          })),
        }
      : { status: "error", error: keywordOpportunitiesResult.error.message, code: keywordOpportunitiesResult.error.code },
    keywordCannibalization: keywordOpportunitiesResult.ok
      ? { status: "ok", issues: keywordOpportunitiesResult.value.cannibalizationIssues.map(toKeywordCannibalizationIssueDto) }
      : { status: "error", error: keywordOpportunitiesResult.error.message, code: keywordOpportunitiesResult.error.code },
    ctrUnderperformers: keywordOpportunitiesResult.ok
      ? { status: "ok", issues: keywordOpportunitiesResult.value.ctrUnderperformers.map(toCtrUnderperformerDto) }
      : { status: "error", error: keywordOpportunitiesResult.error.message, code: keywordOpportunitiesResult.error.code },
  });
}
