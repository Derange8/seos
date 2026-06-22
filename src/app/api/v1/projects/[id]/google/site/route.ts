import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaGoogleConnectionRepository } from "@/infrastructure/persistence/prisma/prisma-google-connection-repository";
import { toGoogleConnectionDto } from "@/application/tracking/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

// Trivial field update with no business rule beyond "a connection must
// already exist" — not worth a dedicated use case the way connecting
// (token exchange + site auto-match) is.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.gscSiteUrl !== "string" || body.gscSiteUrl.length === 0) {
    return NextResponse.json({ error: "gscSiteUrl is required" }, { status: 400 });
  }

  const repository = new PrismaGoogleConnectionRepository(prisma);
  const connection = await repository.findByProjectId(projectId);
  if (!connection) {
    return NextResponse.json({ error: "No Google account connected for this project" }, { status: 404 });
  }

  const updated = connection.withGscSiteUrl(body.gscSiteUrl);
  await repository.save(updated);
  return NextResponse.json(toGoogleConnectionDto(updated));
}
