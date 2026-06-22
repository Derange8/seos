import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaKeywordOpportunityRepository } from "@/infrastructure/persistence/prisma/prisma-keyword-opportunity-repository";
import { PrismaContentSuggestionRepository } from "@/infrastructure/persistence/prisma/prisma-content-suggestion-repository";
import { PrismaLlmSettingsRepository } from "@/infrastructure/persistence/prisma/prisma-llm-settings-repository";
import { DynamicContentSuggestionProvider } from "@/infrastructure/llm/dynamic-content-suggestion-provider";
import { GenerateContentSuggestionUseCase } from "@/application/content-enrichment/use-cases/generate-content-suggestion-use-case";
import { toContentSuggestionDto } from "@/application/content-enrichment/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

const ERROR_STATUS: Record<string, number> = {
  KEYWORD_OPPORTUNITY_NOT_FOUND: 404,
  NO_LLM_PROVIDER_CONFIGURED: 409,
  CONTENT_GENERATION_FAILED: 502,
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; opportunityId: string }> }
) {
  const { id: projectId, opportunityId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const useCase = new GenerateContentSuggestionUseCase({
    keywordOpportunityRepository: new PrismaKeywordOpportunityRepository(prisma),
    contentEnrichment: new DynamicContentSuggestionProvider(new PrismaLlmSettingsRepository(prisma)),
    contentSuggestionRepository: new PrismaContentSuggestionRepository(prisma),
  });

  const result = await useCase.execute(projectId, opportunityId);
  if (!result.ok) {
    const status = ERROR_STATUS[result.error.code] ?? 400;
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status });
  }

  return NextResponse.json(toContentSuggestionDto(result.value));
}
