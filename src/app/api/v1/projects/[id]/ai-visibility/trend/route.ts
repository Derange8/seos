import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaAiVisibilityRunRepository } from "@/infrastructure/persistence/prisma/prisma-ai-visibility-run-repository";
import { toAiVisibilityTrendDto } from "@/application/ai-visibility/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

// Capped well above the "compare last 2 runs" delta the main GET route
// already covers — enough points for a real trend line (daily
// auto-probing means this fills in over weeks) without an unbounded query
// as runs accumulate over a long-lived project.
const MAX_TREND_POINTS = 90;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const runs = await new PrismaAiVisibilityRunRepository(prisma).findRecentByProjectId(projectId, MAX_TREND_POINTS);
  return NextResponse.json(toAiVisibilityTrendDto(runs));
}
