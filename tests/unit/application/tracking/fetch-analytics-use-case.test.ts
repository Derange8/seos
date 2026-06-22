import { describe, expect, it, vi } from "vitest";
import { FetchAnalyticsUseCase, Ga4PropertyNotConfiguredError } from "@/application/tracking/use-cases/fetch-analytics-use-case";
import { GoogleNotConnectedError } from "@/application/tracking/use-cases/fetch-search-performance-use-case";
import { GoogleConnection } from "@/domain/tracking/entities/google-connection";
import { ok } from "@/shared/result";
import type { GoogleOAuthPort } from "@/application/tracking/ports/google-oauth-port";
import type { AnalyticsClientPort } from "@/application/tracking/ports/analytics-client-port";
import type { GoogleConnectionRepositoryPort } from "@/application/tracking/ports/google-connection-repository-port";
import type { AnalyticsSnapshotRepositoryPort } from "@/application/tracking/ports/analytics-snapshot-repository-port";

function connectionWith(ga4PropertyId: string | null): GoogleConnection {
  return GoogleConnection.create("project-1", "refresh-token", "sc-domain:example.com").withGa4PropertyId(ga4PropertyId);
}

function deps(overrides: Partial<{
  googleOAuth: GoogleOAuthPort;
  analyticsClient: AnalyticsClientPort;
  googleConnectionRepository: GoogleConnectionRepositoryPort;
  analyticsSnapshotRepository: AnalyticsSnapshotRepositoryPort;
}> = {}) {
  const googleOAuth: GoogleOAuthPort =
    overrides.googleOAuth ?? {
      buildAuthorizationUrl: vi.fn(),
      exchangeCodeForTokens: vi.fn(),
      refreshAccessToken: vi.fn().mockResolvedValue(ok({ accessToken: "at", refreshToken: null, expiresInSeconds: 3600 })),
    };
  const analyticsClient: AnalyticsClientPort =
    overrides.analyticsClient ?? {
      fetchDailyOrganicTraffic: vi.fn().mockResolvedValue(ok([{ date: "2026-06-01", organicSessions: 20, conversions: 2 }])),
    };
  const googleConnectionRepository: GoogleConnectionRepositoryPort =
    overrides.googleConnectionRepository ?? {
      save: vi.fn(),
      findByProjectId: vi.fn().mockResolvedValue(connectionWith("501234567")),
      deleteByProjectId: vi.fn(),
    };
  const analyticsSnapshotRepository: AnalyticsSnapshotRepositoryPort =
    overrides.analyticsSnapshotRepository ?? { saveMany: vi.fn().mockResolvedValue(undefined), findByProjectId: vi.fn() };
  return { googleOAuth, analyticsClient, googleConnectionRepository, analyticsSnapshotRepository };
}

describe("FetchAnalyticsUseCase", () => {
  it("fetches and saves organic traffic snapshots for a configured property", async () => {
    const dependencies = deps();
    const useCase = new FetchAnalyticsUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].organicSessions).toBe(20);
    }
    expect(dependencies.analyticsSnapshotRepository.saveMany).toHaveBeenCalledTimes(1);
  });

  it("fails with GoogleNotConnectedError when no connection exists", async () => {
    const dependencies = deps({ googleConnectionRepository: { save: vi.fn(), findByProjectId: vi.fn().mockResolvedValue(null), deleteByProjectId: vi.fn() } });
    const useCase = new FetchAnalyticsUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(GoogleNotConnectedError);
  });

  it("fails with Ga4PropertyNotConfiguredError when no property id is set", async () => {
    const dependencies = deps({
      googleConnectionRepository: { save: vi.fn(), findByProjectId: vi.fn().mockResolvedValue(connectionWith(null)), deleteByProjectId: vi.fn() },
    });
    const useCase = new FetchAnalyticsUseCase(dependencies);

    const result = await useCase.execute("project-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(Ga4PropertyNotConfiguredError);
    expect(dependencies.analyticsClient.fetchDailyOrganicTraffic).not.toHaveBeenCalled();
  });
});
