import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { PrismaPageRepository } from "@/infrastructure/persistence/prisma/prisma-page-repository";
import { PrismaContentIdeaRepository } from "@/infrastructure/persistence/prisma/prisma-content-idea-repository";
import { PrismaLlmSettingsRepository } from "@/infrastructure/persistence/prisma/prisma-llm-settings-repository";
import { DynamicContentIdeaProvider } from "@/infrastructure/llm/dynamic-content-idea-provider";
import { GenerateContentIdeasUseCase } from "@/application/content-enrichment/use-cases/generate-content-ideas-use-case";
import { toContentIdeaDto } from "@/application/content-enrichment/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

const ERROR_STATUS: Record<string, number> = {
  NO_CRAWLED_PAGES: 409,
  NO_LLM_PROVIDER_CONFIGURED: 409,
  CONTENT_IDEA_GENERATION_FAILED: 502,
};

// Read-only view of whatever's already stored — separate from POST, which
// actually makes an LLM call. Same split as the keyword-opportunities
// snapshot endpoint.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const ideas = await new PrismaContentIdeaRepository(prisma).findByProjectId(projectId);
  return NextResponse.json(ideas.map(toContentIdeaDto));
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const useCase = new GenerateContentIdeasUseCase({
    crawlJobRepository: new PrismaCrawlJobRepository(prisma),
    pageRepository: new PrismaPageRepository(prisma),
    contentIdea: new DynamicContentIdeaProvider(new PrismaLlmSettingsRepository(prisma)),
    contentIdeaRepository: new PrismaContentIdeaRepository(prisma),
  });

  const result = await useCase.execute(projectId);
  if (!result.ok) {
    const status = ERROR_STATUS[result.error.code] ?? 400;
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status });
  }

  return NextResponse.json(result.value.map(toContentIdeaDto));
}
