import { GoogleOAuthClient } from "@/infrastructure/google/google-oauth-client";

// GOOGLE_OAUTH_CLIENT_ID/SECRET come from a "Desktop app" OAuth client in
// Google Auth Platform (see .env.example) — not really confidential for
// an installed-app client per Google's own docs, but kept in .env anyway
// for consistency with every other credential in this project.
export function createGoogleOAuthClient(): GoogleOAuthClient {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET are not set — see .env.example");
  }
  return new GoogleOAuthClient(clientId, clientSecret);
}
