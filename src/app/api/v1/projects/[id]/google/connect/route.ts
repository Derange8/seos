import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaGoogleConnectionRepository } from "@/infrastructure/persistence/prisma/prisma-google-connection-repository";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { SearchConsoleClient } from "@/infrastructure/google/search-console-client";
import { createGoogleOAuthClient } from "@/infrastructure/google/create-google-oauth-client";
import { OAuthLoopbackServer } from "@/infrastructure/google/oauth-loopback-server";
import { ConsoleLogger } from "@/infrastructure/logging/console-logger";
import { ConnectGoogleAccountUseCase } from "@/application/tracking/use-cases/connect-google-account-use-case";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

// Fixed, dedicated port for the OAuth "installed app" loopback callback —
// separate from the app's own port (3000 in dev, 3100 under Electron), so
// there's never a route-handling conflict between the two.
const LOOPBACK_PORT = 51789;

const logger = new ConsoleLogger();

// Starts the local loopback listener and returns the Google
// authorization URL immediately — the frontend opens that URL in the
// system browser (see project-dashboard.tsx / electron/main.ts's
// setWindowOpenHandler) and polls GET .../google until the connection
// appears. The actual token exchange + site lookup happens in the
// background once the loopback server's promise resolves, deliberately
// not awaited here — an HTTP request can't stay open for however long
// the user takes to approve access in their browser.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let oauthClient;
  try {
    oauthClient = createGoogleOAuthClient();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }

  // Validated above, before starting the loopback server — starting it
  // first and only then discovering the OAuth client isn't configured
  // would leak an open local port with nothing left to close it.
  const state = crypto.randomUUID();
  const loopbackServer = new OAuthLoopbackServer(LOOPBACK_PORT, logger);
  const { redirectUri, result } = loopbackServer.start(state);
  const authorizationUrl = oauthClient.buildAuthorizationUrl(redirectUri, state);

  result
    .then(async ({ code }) => {
      const useCase = new ConnectGoogleAccountUseCase({
        googleOAuth: oauthClient,
        searchConsoleClient: new SearchConsoleClient(),
        googleConnectionRepository: new PrismaGoogleConnectionRepository(prisma),
        projectRepository: new PrismaProjectRepository(prisma),
      });
      const connectResult = await useCase.execute(projectId, code, redirectUri);
      if (!connectResult.ok) {
        logger.error("Failed to complete Google connection", { error: connectResult.error.message });
      }
    })
    .catch((error: unknown) => {
      logger.error("Google OAuth loopback flow failed", { error: String(error) });
    });

  return NextResponse.json({ authorizationUrl });
}
