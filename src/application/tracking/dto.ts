import type { GoogleConnection } from "@/domain/tracking/entities/google-connection";
import type { SearchPerformanceSnapshot } from "@/domain/tracking/entities/search-performance-snapshot";
import type { AnalyticsSnapshot } from "@/domain/tracking/entities/analytics-snapshot";
import type { KeywordOpportunity } from "@/domain/tracking/entities/keyword-opportunity";

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
