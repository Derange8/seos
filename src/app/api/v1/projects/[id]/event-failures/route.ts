import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaEventHandlerFailureStore } from "@/infrastructure/persistence/prisma/prisma-event-handler-failure-store";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const failures = await new PrismaEventHandlerFailureStore(prisma).findRecentByProjectId(projectId);

  return NextResponse.json(
    failures.map((failure) => ({
      id: failure.id,
      eventType: failure.eventType,
      message: failure.message,
      occurredAt: failure.occurredAt.toISOString(),
    }))
  );
}
