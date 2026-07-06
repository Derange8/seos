import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { PrismaAiVisibilityRunRepository } from "@/infrastructure/persistence/prisma/prisma-ai-visibility-run-repository";
import { PrismaLlmSettingsRepository } from "@/infrastructure/persistence/prisma/prisma-llm-settings-repository";
import { DynamicAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/dynamic-ai-visibility-model";
import { DiagnoseVisibilityGapUseCase } from "@/application/ai-visibility/use-cases/diagnose-visibility-gap-use-case";
import { GenerateCitationContentUseCase } from "@/application/ai-visibility/use-cases/generate-citation-content-use-case";
import { BuildFixPlanUseCase } from "@/application/ai-visibility/use-cases/build-fix-plan-use-case";
import { AiVisibilityProviderNotConfiguredError } from "@/application/ai-visibility/errors";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";
import { ConsoleLogger } from "@/infrastructure/logging/console-logger";

// POST (makes several LLM calls) — the automated middle of the loop: for the
// latest web-grounded probe's most-winnable queries, auto-run Diagnose then
// Generate so the user gets ready drafts behind a single approval gate.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const logger = new ConsoleLogger();
  const projectRepository = new PrismaProjectRepository(prisma);
  const runRepository = new PrismaAiVisibilityRunRepository(prisma);
  const model = new DynamicAiVisibilityModel(new PrismaLlmSettingsRepository(prisma), logger);

  const useCase = new BuildFixPlanUseCase({
    runRepository,
    diagnose: new DiagnoseVisibilityGapUseCase({ projectRepository, runRepository, model }),
    generate: new GenerateCitationContentUseCase({ projectRepository, model }),
    logger,
  });

  try {
    const plan = await useCase.execute(projectId);
    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof AiVisibilityProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error), code: "AI_VISIBILITY_FIX_PLAN_FAILED" },
      { status: 502 }
    );
  }
}
