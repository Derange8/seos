import { DomainError } from "@/shared/domain-error";
import type { Result } from "@/shared/result";

export class GoogleOAuthError extends DomainError {
  readonly code = "GOOGLE_OAUTH_ERROR";
}

export interface GoogleTokens {
  accessToken: string;
  // null on a refresh-token exchange (Google only issues a refresh token
  // on first consent, or when access_type=offline&prompt=consent forces
  // a fresh one) — callers exchanging an authorization code should always
  // get one; callers refreshing an access token never do.
  refreshToken: string | null;
  expiresInSeconds: number;
}

export interface GoogleOAuthPort {
  buildAuthorizationUrl(redirectUri: string, state: string): string;
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<Result<GoogleTokens, GoogleOAuthError>>;
  refreshAccessToken(refreshToken: string): Promise<Result<GoogleTokens, GoogleOAuthError>>;
}
