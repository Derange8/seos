import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaGoogleConnectionRepository } from "@/infrastructure/persistence/prisma/prisma-google-connection-repository";
import { SearchConsoleClient } from "@/infrastructure/google/search-console-client";
import { createGoogleOAuthClient } from "@/infrastructure/google/create-google-oauth-client";
import { toGoogleConnectionDto } from "@/application/tracking/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const connection = await new PrismaGoogleConnectionRepository(prisma).findByProjectId(projectId);
  if (!connection) {
    return NextResponse.json({ connected: false });
  }

  const dto = toGoogleConnectionDto(connection);

  // No Search Console property picked yet — fetch the live list of sites
  // this account has access to so the dashboard can render a picker.
  // Cheap, read-only call; not worth caching for a once-per-page-load read.
  if (!connection.gscSiteUrl) {
    try {
      const tokenResult = await createGoogleOAuthClient().refreshAccessToken(connection.refreshToken);
      if (tokenResult.ok) {
        const sitesResult = await new SearchConsoleClient().listSites(tokenResult.value.accessToken);
        if (sitesResult.ok) {
          return NextResponse.json({ ...dto, availableSites: sitesResult.value });
        }
      }
    } catch {
      // Falls through to returning the plain connection dto below — the
      // site picker just won't have options this load, not fatal.
    }
  }

  return NextResponse.json(dto);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await new PrismaGoogleConnectionRepository(prisma).deleteByProjectId(projectId);
  return new NextResponse(null, { status: 204 });
}
