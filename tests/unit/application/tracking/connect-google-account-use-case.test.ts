import { describe, expect, it, vi } from "vitest";
import { ConnectGoogleAccountUseCase } from "@/application/tracking/use-cases/connect-google-account-use-case";
import { Project } from "@/domain/projects/entities/project";
import { DomainName } from "@/domain/projects/value-objects/domain-name";
import { ok, err } from "@/shared/result";
import { GoogleOAuthError } from "@/application/tracking/ports/google-oauth-port";
import type { GoogleOAuthPort } from "@/application/tracking/ports/google-oauth-port";
import type { SearchConsoleClientPort } from "@/application/tracking/ports/search-console-client-port";
import type { GoogleConnectionRepositoryPort } from "@/application/tracking/ports/google-connection-repository-port";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";

function project(domain: string): Project {
  const domainResult = DomainName.create(domain);
  if (!domainResult.ok) throw new Error("bad domain in test fixture");
  return Project.create("Test Project", domainResult.value);
}

function deps(overrides: Partial<ReturnType<typeof baseDeps>> = {}) {
  return { ...baseDeps(), ...overrides };
}

function baseDeps() {
  const googleOAuth: GoogleOAuthPort = {
    buildAuthorizationUrl: vi.fn(),
    exchangeCodeForTokens: vi.fn().mockResolvedValue(ok({ accessToken: "at", refreshToken: "rt", expiresInSeconds: 3600 })),
    refreshAccessToken: vi.fn(),
  };
  const searchConsoleClient: SearchConsoleClientPort = {
    listSites: vi.fn().mockResolvedValue(ok(["sc-domain:example.com"])),
    fetchDailyPerformance: vi.fn(),
    fetchPageQueryPerformance: vi.fn(),
  };
  const googleConnectionRepository: GoogleConnectionRepositoryPort = {
    save: vi.fn().mockResolvedValue(undefined),
    findByProjectId: vi.fn().mockResolvedValue(null),
    deleteByProjectId: vi.fn().mockResolvedValue(undefined),
  };
  const projectRepository: ProjectRepositoryPort = {
    save: vi.fn(),
    findById: vi.fn().mockResolvedValue(project("example.com")),
    findByDomain: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
  };
  return { googleOAuth, searchConsoleClient, googleConnectionRepository, projectRepository };
}

describe("ConnectGoogleAccountUseCase", () => {
  it("auto-matches a Search Console domain property against the project's domain", async () => {
    const dependencies = deps();
    const useCase = new ConnectGoogleAccountUseCase(dependencies);

    const result = await useCase.execute("project-1", "code", "http://127.0.0.1:51789/callback");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.connection.gscSiteUrl).toBe("sc-domain:example.com");
      expect(result.value.availableSites).toEqual(["sc-domain:example.com"]);
    }
    expect(dependencies.googleConnectionRepository.save).toHaveBeenCalledTimes(1);
  });

  it("auto-matches a URL-prefix property, ignoring a www. prefix", async () => {
    const dependencies = deps({
      searchConsoleClient: {
        listSites: vi.fn().mockResolvedValue(ok(["https://www.example.com/"])),
        fetchDailyPerformance: vi.fn(),
    fetchPageQueryPerformance: vi.fn(),
      },
    });
    const useCase = new ConnectGoogleAccountUseCase(dependencies);

    const result = await useCase.execute("project-1", "code", "http://127.0.0.1:51789/callback");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.connection.gscSiteUrl).toBe("https://www.example.com/");
  });

  it("leaves gscSiteUrl null when no site matches the project's domain", async () => {
    const dependencies = deps({
      searchConsoleClient: { listSites: vi.fn().mockResolvedValue(ok(["sc-domain:other.com"])), fetchDailyPerformance: vi.fn(), fetchPageQueryPerformance: vi.fn() },
    });
    const useCase = new ConnectGoogleAccountUseCase(dependencies);

    const result = await useCase.execute("project-1", "code", "http://127.0.0.1:51789/callback");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.connection.gscSiteUrl).toBeNull();
  });

  it("fails when Google does not return a refresh token", async () => {
    const dependencies = deps({
      googleOAuth: {
        buildAuthorizationUrl: vi.fn(),
        exchangeCodeForTokens: vi.fn().mockResolvedValue(ok({ accessToken: "at", refreshToken: null, expiresInSeconds: 3600 })),
        refreshAccessToken: vi.fn(),
      },
    });
    const useCase = new ConnectGoogleAccountUseCase(dependencies);

    const result = await useCase.execute("project-1", "code", "http://127.0.0.1:51789/callback");

    expect(result.ok).toBe(false);
    expect(dependencies.googleConnectionRepository.save).not.toHaveBeenCalled();
  });

  it("propagates a token exchange failure without saving anything", async () => {
    const dependencies = deps({
      googleOAuth: {
        buildAuthorizationUrl: vi.fn(),
        exchangeCodeForTokens: vi.fn().mockResolvedValue(err(new GoogleOAuthError("bad code"))),
        refreshAccessToken: vi.fn(),
      },
    });
    const useCase = new ConnectGoogleAccountUseCase(dependencies);

    const result = await useCase.execute("project-1", "code", "http://127.0.0.1:51789/callback");

    expect(result.ok).toBe(false);
    expect(dependencies.googleConnectionRepository.save).not.toHaveBeenCalled();
  });
});
