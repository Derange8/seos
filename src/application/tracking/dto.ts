import type { GoogleConnection } from "@/domain/tracking/entities/google-connection";
import type { SearchPerformanceSnapshot } from "@/domain/tracking/entities/search-performance-snapshot";
import type { AnalyticsSnapshot } from "@/domain/tracking/entities/analytics-snapshot";
import type { KeywordOpportunity } from "@/domain/tracking/entities/keyword-opportunity";
import type { CannibalizingPage, KeywordCannibalizationIssue } from "@/domain/tracking/entities/keyword-cannibalization";
import type { CtrUnderperformer } from "@/domain/tracking/entities/ctr-underperformer";

export interface GoogleConnectionDto {
  connected: true;
  gscSiteUrl: string | null;
  ga4PropertyId: string | null;
  autoRefreshEnabled: boolean;
  createdAt: string;
}

// The refresh token is deliberately never included — same rule every
// other stored credential DTO in this codebase follows.
export function toGoogleConnectionDto(connection: GoogleConnection): GoogleConnectionDto {
  return {
    connected: true,
    gscSiteUrl: connection.gscSiteUrl,
    ga4PropertyId: connection.ga4PropertyId,
    autoRefreshEnabled: connection.autoRefreshEnabled,
    createdAt: connection.createdAt.toISOString(),
  };
}

export interface SearchPerformanceSnapshotDto {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export function toSearchPerformanceSnapshotDto(snapshot: SearchPerformanceSnapshot): SearchPerformanceSnapshotDto {
  return {
    date: snapshot.date.toISOString().slice(0, 10),
    clicks: snapshot.clicks,
    impressions: snapshot.impressions,
    ctr: snapshot.ctr,
    position: snapshot.position,
  };
}

export interface AnalyticsSnapshotDto {
  date: string;
  organicSessions: number;
  conversions: number;
}

export function toAnalyticsSnapshotDto(snapshot: AnalyticsSnapshot): AnalyticsSnapshotDto {
  return {
    date: snapshot.date.toISOString().slice(0, 10),
    organicSessions: snapshot.organicSessions,
    conversions: snapshot.conversions,
  };
}

export interface KeywordOpportunityDto {
  id: string;
  pageUrl: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export function toKeywordOpportunityDto(opportunity: KeywordOpportunity): KeywordOpportunityDto {
  return {
    id: opportunity.id,
    pageUrl: opportunity.pageUrl,
    query: opportunity.query,
    clicks: opportunity.clicks,
    impressions: opportunity.impressions,
    ctr: opportunity.ctr,
    position: opportunity.position,
  };
}

export interface KeywordCannibalizationIssueDto {
  id: string;
  query: string;
  pages: readonly CannibalizingPage[];
}

export function toKeywordCannibalizationIssueDto(issue: KeywordCannibalizationIssue): KeywordCannibalizationIssueDto {
  return {
    id: issue.id,
    query: issue.query,
    pages: issue.pages,
  };
}

export interface CtrUnderperformerDto {
  id: string;
  pageUrl: string;
  query: string;
  position: number;
  ctr: number;
  expectedCtr: number;
  clicks: number;
  impressions: number;
}

export function toCtrUnderperformerDto(issue: CtrUnderperformer): CtrUnderperformerDto {
  return {
    id: issue.id,
    pageUrl: issue.pageUrl,
    query: issue.query,
    position: issue.position,
    ctr: issue.ctr,
    expectedCtr: issue.expectedCtr,
    clicks: issue.clicks,
    impressions: issue.impressions,
  };
}
