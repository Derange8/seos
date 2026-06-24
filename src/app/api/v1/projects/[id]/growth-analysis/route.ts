import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { PrismaPageRepository } from "@/infrastructure/persistence/prisma/prisma-page-repository";
import { PrismaGrowthAnalysisRepository } from "@/infrastructure/persistence/prisma/prisma-growth-analysis-repository";
import { PrismaLlmSettingsRepository } from "@/infrastructure/persistence/prisma/prisma-llm-settings-repository";
import { DynamicGrowthAnalysisProvider } from "@/infrastructure/llm/dynamic-growth-analysis-provider";
import { GenerateGrowthAnalysisUseCase } from "@/application/content-enrichment/use-cases/generate-growth-analysis-use-case";
import { toGrowthAnalysisDto } from "@/application/content-enrichment/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

const ERROR_STATUS: Record<string, number> = {
  NO_CRAWLED_PAGES: 409,
  NO_LLM_PROVIDER_CONFIGURED: 409,
  GROWTH_ANALYSIS_GENERATION_FAILED: 502,
};

// Read-only view of whatever's already stored — separate from POST, which
// actually makes an LLM call. Same split as content-ideas/keyword-opportunities.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const analysis = await new PrismaGrowthAnalysisRepository(prisma).findByProjectId(projectId);
  return NextResponse.json(analysis ? toGrowthAnalysisDto(analysis) : null);
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const useCase = new GenerateGrowthAnalysisUseCase({
    crawlJobRepository: new PrismaCrawlJobRepository(prisma),
    pageRepository: new PrismaPageRepository(prisma),
    growthAnalysis: new DynamicGrowthAnalysisProvider(new PrismaLlmSettingsRepository(prisma)),
    growthAnalysisRepository: new PrismaGrowthAnalysisRepository(prisma),
  });

  const result = await useCase.execute(projectId);
  if (!result.ok) {
    const status = ERROR_STATUS[result.error.code] ?? 400;
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status });
  }

  return NextResponse.json(toGrowthAnalysisDto(result.value));
}
