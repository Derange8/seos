import { describe, expect, it, vi } from "vitest";
import { FetchSearchPerformanceUseCase, GoogleNotConnectedError, GscSiteNotConfiguredError } from "@/application/tracking/use-cases/fetch-search-performance-use-case";
import { GoogleConnection } from "@/domain/tracking/entities/google-connection";
import { ok } from "@/shared/result";
import type { GoogleOAuthPort } from "@/application/tracking/ports/google-oauth-port";
import type { SearchConsoleClientPort } from "@/application/tracking/ports/search-console-client-port";
import type { GoogleConnectionRepositoryPort } from "@/application/tracking/ports/google-connection-repository-port";
import type { SearchPerformanceRepositoryPort } from "@/application/tracking/ports/search-performance-repository-port";

function connectionWith(gscSiteUrl: string | null): GoogleConnection {
  return GoogleConnection.create("project-1", "refresh-token", gscSiteUrl);
}

function deps(overrides: Partial<{
  googleOAuth: GoogleOAuthPort;
  searchConsoleClient: SearchConsoleClientPort;
  googleConnectionRepository: GoogleConnectionRepositoryPort;
  searchPerformanceRepository: SearchPerformanceRepositoryPort;
}> = {}) {
  const googleOAuth: GoogleOAuthPort =
    overrides.googleOAuth ?? {
      buildAuthorizationUrl: vi.fn(),
      exchangeCodeForTokens: vi.fn(),
      refreshAccessToken: vi.fn().mockResolvedValue(ok({ accessToken: "at", refreshToken: null, expiresInSeconds: 3600 })),
    };
  const searchConsoleClient: SearchConsoleClientPort =
    overrides.searchConsoleClient ?? {
      listSites: vi.fn(),
      fetchDailyPerformance: vi.fn().mockResolvedValue(ok([{ date: "2026-06-01", clicks: 5, impressions: 50, ctr: 0.1, position: 4.5 }])),
      fetchPageQueryPerformance: vi.fn().mockResolvedValue(ok([])),
    };
  const googleConnectionRepository: GoogleConnectionRepositoryPort =
    overrides.googleConnectionRepository ?? {
      save: vi.fn(),
      findByProjectId: vi.fn().mockResolvedValue(connectionWith("sc-domain:example.com")),
      deleteByProjectId: vi.fn(),
    };
  const searchPerformanceRepository: SearchPerformanceRepositoryPort =
    overrides.searchPerformanceRepository ?? {
      saveMany: vi.fn().mockResolvedValue(undefined),
      findByProjectId: vi.fn(),
      findLatestFetchedAt: vi.fn(),
    };
  return { googleOAuth, searchConsoleClient, googleConnectionRepository, searchPerformanceRepository };
}

describe("FetchSearchPerformanceUseCase", () => {
  it("fetches and saves snapshots for a configured connection", async () => {
    const dependencies = deps();
    const useCase = new FetchSearchPerformanceUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].clicks).toBe(5);
    }
    expect(dependencies.searchPerformanceRepository.saveMany).toHaveBeenCalledTimes(1);

    const [, , startDate, endDate] = vi.mocked(dependencies.searchConsoleClient.fetchDailyPerformance).mock.calls[0];
    expect(new Date(startDate).getTime()).toBeLessThan(new Date(endDate).getTime());
  });

  it("fails with GoogleNotConnectedError when no connection exists", async () => {
    const dependencies = deps({ googleConnectionRepository: { save: vi.fn(), findByProjectId: vi.fn().mockResolvedValue(null), deleteByProjectId: vi.fn() } });
    const useCase = new FetchSearchPerformanceUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(GoogleNotConnectedError);
  });

  it("fails with GscSiteNotConfiguredError when connected but no site picked yet", async () => {
    const dependencies = deps({
      googleConnectionRepository: { save: vi.fn(), findByProjectId: vi.fn().mockResolvedValue(connectionWith(null)), deleteByProjectId: vi.fn() },
    });
    const useCase = new FetchSearchPerformanceUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(GscSiteNotConfiguredError);
    expect(dependencies.searchConsoleClient.fetchDailyPerformance).not.toHaveBeenCalled();
  });
});
