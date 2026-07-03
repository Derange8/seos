import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { PrismaPageRepository } from "@/infrastructure/persistence/prisma/prisma-page-repository";
import { PrismaLlmSettingsRepository } from "@/infrastructure/persistence/prisma/prisma-llm-settings-repository";
import { DynamicAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/dynamic-ai-visibility-model";
import { SuggestProbeTargetUseCase } from "@/application/ai-visibility/use-cases/suggest-probe-target-use-case";
import { AiVisibilityProviderNotConfiguredError } from "@/application/ai-visibility/errors";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";
import { ConsoleLogger } from "@/infrastructure/logging/console-logger";

// POST (not GET) because it makes a real LLM call — same reasoning as the
// content-ideas generate endpoint.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const useCase = new SuggestProbeTargetUseCase({
    projectRepository: new PrismaProjectRepository(prisma),
    crawlJobRepository: new PrismaCrawlJobRepository(prisma),
    pageRepository: new PrismaPageRepository(prisma),
    model: new DynamicAiVisibilityModel(new PrismaLlmSettingsRepository(prisma), new ConsoleLogger()),
  });

  try {
    const suggestion = await useCase.execute(projectId);
    return NextResponse.json(suggestion);
  } catch (error) {
    if (error instanceof AiVisibilityProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error), code: "AI_VISIBILITY_SUGGEST_FAILED" },
      { status: 502 }
    );
  }
}
