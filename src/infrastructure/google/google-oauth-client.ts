import { GoogleOAuthError, type GoogleOAuthPort, type GoogleTokens } from "@/application/tracking/ports/google-oauth-port";
import { err, ok, type Result } from "@/shared/result";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// Read-only scopes only — Seos never writes to Search Console or
// Analytics, it only reads performance data to display in the dashboard.
const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export class GoogleOAuthClient implements GoogleOAuthPort {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {}

  buildAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      // access_type=offline + prompt=consent together guarantee a
      // refresh_token is issued every time, not just on the very first
      // consent for a given account — without prompt=consent, Google
      // silently omits it on a re-auth if one was already granted before.
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<Result<GoogleTokens, GoogleOAuthError>> {
    return this.requestTokens({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<Result<GoogleTokens, GoogleOAuthError>> {
    return this.requestTokens({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "refresh_token",
    });
  }

  private async requestTokens(body: Record<string, string>): Promise<Result<GoogleTokens, GoogleOAuthError>> {
    let response: Response;
    try {
      response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
      });
    } catch (error) {
      return err(new GoogleOAuthError(`Could not reach Google's token endpoint: ${String(error)}`));
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return err(new GoogleOAuthError(`Google token request failed (${response.status}): ${text}`));
    }

    const data = (await response.json()) as GoogleTokenResponse;
    return ok({
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresInSeconds: data.expires_in,
    });
  }
}
