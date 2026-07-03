import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { PrismaAiVisibilityRunRepository } from "@/infrastructure/persistence/prisma/prisma-ai-visibility-run-repository";
import { PrismaLlmSettingsRepository } from "@/infrastructure/persistence/prisma/prisma-llm-settings-repository";
import { DynamicAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/dynamic-ai-visibility-model";
import { DiagnoseVisibilityGapUseCase } from "@/application/ai-visibility/use-cases/diagnose-visibility-gap-use-case";
import { AiVisibilityProviderNotConfiguredError } from "@/application/ai-visibility/errors";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";
import { ConsoleLogger } from "@/infrastructure/logging/console-logger";

// POST (makes an LLM call) — diagnoses why the site isn't recommended for one
// query and what would change that.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const query = typeof (body as { query?: unknown })?.query === "string" ? (body as { query: string }).query.trim() : "";
  if (query.length === 0) {
    return NextResponse.json({ error: "A query is required", code: "NO_QUERY" }, { status: 400 });
  }

  const useCase = new DiagnoseVisibilityGapUseCase({
    projectRepository: new PrismaProjectRepository(prisma),
    runRepository: new PrismaAiVisibilityRunRepository(prisma),
    model: new DynamicAiVisibilityModel(new PrismaLlmSettingsRepository(prisma), new ConsoleLogger()),
  });

  try {
    const gaps = await useCase.execute(projectId, query);
    return NextResponse.json({ gaps });
  } catch (error) {
    if (error instanceof AiVisibilityProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error), code: "AI_VISIBILITY_DIAGNOSE_FAILED" },
      { status: 502 }
    );
  }
}
