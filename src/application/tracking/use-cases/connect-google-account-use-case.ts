import { GoogleConnection } from "@/domain/tracking/entities/google-connection";
import type { GoogleOAuthPort } from "@/application/tracking/ports/google-oauth-port";
import { GoogleOAuthError } from "@/application/tracking/ports/google-oauth-port";
import type { SearchConsoleApiError, SearchConsoleClientPort } from "@/application/tracking/ports/search-console-client-port";
import type { GoogleConnectionRepositoryPort } from "@/application/tracking/ports/google-connection-repository-port";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";
import { err, ok, type Result } from "@/shared/result";

export interface ConnectGoogleAccountDeps {
  googleOAuth: GoogleOAuthPort;
  searchConsoleClient: SearchConsoleClientPort;
  googleConnectionRepository: GoogleConnectionRepositoryPort;
  projectRepository: ProjectRepositoryPort;
}

// A Search Console "site" is either a domain property ("sc-domain:
// example.com") or a URL-prefix property ("https://example.com/", with or
// without "www." and a trailing slash) — normalize both forms down to a
// bare hostname before comparing against the project's own domain.
function siteHostname(site: string): string | null {
  if (site.startsWith("sc-domain:")) return site.slice("sc-domain:".length);
  try {
    return new URL(site).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function findMatchingSite(sites: readonly string[], domain: string): string | null {
  return sites.find((site) => siteHostname(site) === domain) ?? null;
}

// Runs once the OAuth loopback server (see oauth-loopback-server.ts)
// receives the authorization code — pure application logic from here on,
// no HTTP server concern leaks into this use case. Auto-picks a Search
// Console property matching the project's verified domain when exactly
// one exists; otherwise gscSiteUrl stays null and the dashboard shows a
// picker built from the same listSites() call's result.
export class ConnectGoogleAccountUseCase {
  constructor(private readonly deps: ConnectGoogleAccountDeps) {}

  async execute(
    projectId: string,
    code: string,
    redirectUri: string
  ): Promise<Result<{ connection: GoogleConnection; availableSites: string[] }, GoogleOAuthError | SearchConsoleApiError>> {
    const tokenResult = await this.deps.googleOAuth.exchangeCodeForTokens(code, redirectUri);
    if (!tokenResult.ok) return tokenResult;

    if (!tokenResult.value.refreshToken) {
      return err(
        new GoogleOAuthError("Google did not return a refresh token for this account — disconnect and reconnect to get a fresh one.")
      );
    }

    const sitesResult = await this.deps.searchConsoleClient.listSites(tokenResult.value.accessToken);
    if (!sitesResult.ok) return sitesResult;

    const project = await this.deps.projectRepository.findById(projectId);
    const matchedSite = project ? findMatchingSite(sitesResult.value, project.domain.value) : null;

    const connection = GoogleConnection.create(projectId, tokenResult.value.refreshToken, matchedSite);
    await this.deps.googleConnectionRepository.save(connection);

    return ok({ connection, availableSites: sitesResult.value });
  }
}
