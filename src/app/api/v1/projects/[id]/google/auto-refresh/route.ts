import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaGoogleConnectionRepository } from "@/infrastructure/persistence/prisma/prisma-google-connection-repository";
import { toGoogleConnectionDto } from "@/application/tracking/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  const repository = new PrismaGoogleConnectionRepository(prisma);
  const connection = await repository.findByProjectId(projectId);
  if (!connection) {
    return NextResponse.json({ error: "No Google account connected for this project" }, { status: 404 });
  }

  const updated = connection.withAutoRefreshEnabled(body.enabled);
  await repository.save(updated);
  return NextResponse.json(toGoogleConnectionDto(updated));
}
