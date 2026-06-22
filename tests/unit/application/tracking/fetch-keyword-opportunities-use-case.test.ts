import { describe, expect, it, vi } from "vitest";
import {
  FetchKeywordOpportunitiesUseCase,
  GoogleNotConnectedError,
  GscSiteNotConfiguredError,
} from "@/application/tracking/use-cases/fetch-keyword-opportunities-use-case";
import { GoogleConnection } from "@/domain/tracking/entities/google-connection";
import { ok } from "@/shared/result";
import type { GoogleOAuthPort } from "@/application/tracking/ports/google-oauth-port";
import type { PageQueryPerformance, SearchConsoleClientPort } from "@/application/tracking/ports/search-console-client-port";
import type { GoogleConnectionRepositoryPort } from "@/application/tracking/ports/google-connection-repository-port";
import type { KeywordOpportunityRepositoryPort } from "@/application/tracking/ports/keyword-opportunity-repository-port";
import type { PagePerformanceRepositoryPort } from "@/application/tracking/ports/page-performance-repository-port";

function connectionWith(gscSiteUrl: string | null): GoogleConnection {
  return GoogleConnection.create("project-1", "refresh-token", gscSiteUrl);
}

const STRIKING_DISTANCE_ROW: PageQueryPerformance = {
  page: "https://example.com/blog/widgets",
  query: "best widgets",
  clicks: 12,
  impressions: 300,
  ctr: 0.04,
  position: 14.2,
};

function deps(
  overrides: Partial<{
    googleOAuth: GoogleOAuthPort;
    searchConsoleClient: SearchConsoleClientPort;
    googleConnectionRepository: GoogleConnectionRepositoryPort;
    keywordOpportunityRepository: KeywordOpportunityRepositoryPort;
    pagePerformanceRepository: PagePerformanceRepositoryPort;
  }> = {}
) {
  const googleOAuth: GoogleOAuthPort =
    overrides.googleOAuth ?? {
      buildAuthorizationUrl: vi.fn(),
      exchangeCodeForTokens: vi.fn(),
      refreshAccessToken: vi.fn().mockResolvedValue(ok({ accessToken: "at", refreshToken: null, expiresInSeconds: 3600 })),
    };
  const searchConsoleClient: SearchConsoleClientPort =
    overrides.searchConsoleClient ?? {
      listSites: vi.fn(),
      fetchDailyPerformance: vi.fn(),
      fetchPageQueryPerformance: vi.fn().mockResolvedValue(ok([STRIKING_DISTANCE_ROW])),
    };
  const googleConnectionRepository: GoogleConnectionRepositoryPort =
    overrides.googleConnectionRepository ?? {
      save: vi.fn(),
      findByProjectId: vi.fn().mockResolvedValue(connectionWith("sc-domain:example.com")),
      deleteByProjectId: vi.fn(),
    };
  const keywordOpportunityRepository: KeywordOpportunityRepositoryPort =
    overrides.keywordOpportunityRepository ?? {
      saveMany: vi.fn().mockResolvedValue(undefined),
      findByProjectId: vi.fn(),
      findById: vi.fn(),
    };
  const pagePerformanceRepository: PagePerformanceRepositoryPort =
    overrides.pagePerformanceRepository ?? {
      saveMany: vi.fn().mockResolvedValue(undefined),
      findByProjectId: vi.fn(),
    };
  return { googleOAuth, searchConsoleClient, googleConnectionRepository, keywordOpportunityRepository, pagePerformanceRepository };
}

describe("FetchKeywordOpportunitiesUseCase", () => {
  it("keeps rows inside the striking-distance position band with enough impressions", async () => {
    const dependencies = deps();
    const useCase = new FetchKeywordOpportunitiesUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].query).toBe("best widgets");
      expect(result.value[0].pageUrl).toBe("https://example.com/blog/widgets");
    }
    expect(dependencies.keywordOpportunityRepository.saveMany).toHaveBeenCalledTimes(1);
  });

  it("persists per-page totals even for a row excluded from the striking-distance shortlist (already on page 1)", async () => {
    const dependencies = deps({
      searchConsoleClient: {
        listSites: vi.fn(),
        fetchDailyPerformance: vi.fn(),
        fetchPageQueryPerformance: vi.fn().mockResolvedValue(ok([{ ...STRIKING_DISTANCE_ROW, position: 3 }])),
      },
    });
    const useCase = new FetchKeywordOpportunitiesUseCase(dependencies);

    await useCase.execute("project-1");

    expect(dependencies.keywordOpportunityRepository.saveMany).toHaveBeenCalledWith([]);
    expect(dependencies.pagePerformanceRepository.saveMany).toHaveBeenCalledTimes(1);
    const savedPages = vi.mocked(dependencies.pagePerformanceRepository.saveMany).mock.calls[0][0];
    expect(savedPages).toHaveLength(1);
    expect(savedPages[0].pageUrl).toBe("https://example.com/blog/widgets");
    expect(savedPages[0].impressions).toBe(300);
    expect(savedPages[0].clicks).toBe(12);
  });

  it("sums multiple queries on the same page into one PagePerformance row", async () => {
    const dependencies = deps({
      searchConsoleClient: {
        listSites: vi.fn(),
        fetchDailyPerformance: vi.fn(),
        fetchPageQueryPerformance: vi.fn().mockResolvedValue(
          ok([
            STRIKING_DISTANCE_ROW,
            { ...STRIKING_DISTANCE_ROW, query: "widget reviews", clicks: 3, impressions: 100, position: 8 },
          ])
        ),
      },
    });
    const useCase = new FetchKeywordOpportunitiesUseCase(dependencies);

    await useCase.execute("project-1");

    const savedPages = vi.mocked(dependencies.pagePerformanceRepository.saveMany).mock.calls[0][0];
    expect(savedPages).toHaveLength(1);
    expect(savedPages[0].clicks).toBe(15);
    expect(savedPages[0].impressions).toBe(400);
  });

  it("drops rows already on page 1 (position below the band)", async () => {
    const dependencies = deps({
      searchConsoleClient: {
        listSites: vi.fn(),
        fetchDailyPerformance: vi.fn(),
        fetchPageQueryPerformance: vi.fn().mockResolvedValue(ok([{ ...STRIKING_DISTANCE_ROW, position: 3 }])),
      },
    });
    const useCase = new FetchKeywordOpportunitiesUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(0);
  });

  it("drops rows ranked beyond the band (too far down to be 'striking distance')", async () => {
    const dependencies = deps({
      searchConsoleClient: {
        listSites: vi.fn(),
        fetchDailyPerformance: vi.fn(),
        fetchPageQueryPerformance: vi.fn().mockResolvedValue(ok([{ ...STRIKING_DISTANCE_ROW, position: 45 }])),
      },
    });
    const useCase = new FetchKeywordOpportunitiesUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(0);
  });

  it("drops low-impression rows even if the position is in range (noise filter)", async () => {
    const dependencies = deps({
      searchConsoleClient: {
        listSites: vi.fn(),
        fetchDailyPerformance: vi.fn(),
        fetchPageQueryPerformance: vi.fn().mockResolvedValue(ok([{ ...STRIKING_DISTANCE_ROW, impressions: 2 }])),
      },
    });
    const useCase = new FetchKeywordOpportunitiesUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(0);
  });

  it("fails with GoogleNotConnectedError when no connection exists", async () => {
    const dependencies = deps({
      googleConnectionRepository: { save: vi.fn(), findByProjectId: vi.fn().mockResolvedValue(null), deleteByProjectId: vi.fn() },
    });
    const useCase = new FetchKeywordOpportunitiesUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(GoogleNotConnectedError);
  });

  it("fails with GscSiteNotConfiguredError when connected but no site picked yet", async () => {
    const dependencies = deps({
      googleConnectionRepository: { save: vi.fn(), findByProjectId: vi.fn().mockResolvedValue(connectionWith(null)), deleteByProjectId: vi.fn() },
    });
    const useCase = new FetchKeywordOpportunitiesUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(GscSiteNotConfiguredError);
    expect(dependencies.searchConsoleClient.fetchPageQueryPerformance).not.toHaveBeenCalled();
  });
});
