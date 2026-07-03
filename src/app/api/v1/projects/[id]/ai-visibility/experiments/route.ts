import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaVisibilityExperimentRepository } from "@/infrastructure/persistence/prisma/prisma-visibility-experiment-repository";
import { toVisibilityExperimentDto } from "@/application/ai-visibility/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

// Read-only ledger of tracked visibility experiments for the project.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const experiments = await new PrismaVisibilityExperimentRepository(prisma).findByProjectId(projectId);
  return NextResponse.json(experiments.map(toVisibilityExperimentDto));
}
