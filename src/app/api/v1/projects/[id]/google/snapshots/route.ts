import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaSearchPerformanceRepository } from "@/infrastructure/persistence/prisma/prisma-search-performance-repository";
import { PrismaAnalyticsSnapshotRepository } from "@/infrastructure/persistence/prisma/prisma-analytics-snapshot-repository";
import { PrismaKeywordOpportunityRepository } from "@/infrastructure/persistence/prisma/prisma-keyword-opportunity-repository";
import { PrismaKeywordCannibalizationRepository } from "@/infrastructure/persistence/prisma/prisma-keyword-cannibalization-repository";
import { PrismaCtrUnderperformerRepository } from "@/infrastructure/persistence/prisma/prisma-ctr-underperformer-repository";
import { PrismaContentSuggestionRepository } from "@/infrastructure/persistence/prisma/prisma-content-suggestion-repository";
import { toSearchPerformanceSnapshotDto, toAnalyticsSnapshotDto, toKeywordOpportunityDto, toKeywordCannibalizationIssueDto, toCtrUnderperformerDto } from "@/application/tracking/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

// Read-only view of whatever's already stored — separate from
// POST .../refresh, which actually goes out to Google. The dashboard
// calls this on mount so reloading the page doesn't lose previously
// fetched data (same gap other cards have — see project memory).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [searchPerformance, analytics, keywordOpportunities, contentSuggestions, keywordCannibalization, ctrUnderperformers] =
    await Promise.all([
      new PrismaSearchPerformanceRepository(prisma).findByProjectId(projectId),
      new PrismaAnalyticsSnapshotRepository(prisma).findByProjectId(projectId),
      new PrismaKeywordOpportunityRepository(prisma).findByProjectId(projectId),
      new PrismaContentSuggestionRepository(prisma).findByProjectId(projectId),
      new PrismaKeywordCannibalizationRepository(prisma).findByProjectId(projectId),
      new PrismaCtrUnderperformerRepository(prisma).findByProjectId(projectId),
    ]);

  const suggestionByOpportunityId = new Map(
    contentSuggestions.map((suggestion) => [suggestion.keywordOpportunityId, suggestion.content])
  );

  return NextResponse.json({
    searchPerformance: searchPerformance.map(toSearchPerformanceSnapshotDto),
    analytics: analytics.map(toAnalyticsSnapshotDto),
    keywordOpportunities: keywordOpportunities.map((opportunity) => ({
      ...toKeywordOpportunityDto(opportunity),
      suggestion: suggestionByOpportunityId.get(opportunity.id) ?? null,
    })),
    keywordCannibalization: keywordCannibalization.map(toKeywordCannibalizationIssueDto),
    ctrUnderperformers: ctrUnderperformers.map(toCtrUnderperformerDto),
  });
}
