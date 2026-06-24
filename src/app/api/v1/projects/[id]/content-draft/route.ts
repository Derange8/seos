import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { PrismaPageRepository } from "@/infrastructure/persistence/prisma/prisma-page-repository";
import { PrismaPageContentDraftRepository } from "@/infrastructure/persistence/prisma/prisma-page-content-draft-repository";
import { PrismaLlmSettingsRepository } from "@/infrastructure/persistence/prisma/prisma-llm-settings-repository";
import { DynamicPageContentDraftProvider } from "@/infrastructure/llm/dynamic-page-content-draft-provider";
import { GeneratePageContentDraftUseCase } from "@/application/content-enrichment/use-cases/generate-page-content-draft-use-case";
import { toPageContentDraftDto } from "@/application/content-enrichment/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

const ERROR_STATUS: Record<string, number> = {
  PAGE_NOT_FOUND: 404,
  NO_LLM_PROVIDER_CONFIGURED: 409,
  PAGE_CONTENT_DRAFT_GENERATION_FAILED: 502,
};

// Read-only view of whatever's already stored — separate from POST, which
// makes the LLM call. Same split as content-ideas/growth-analysis.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const drafts = await new PrismaPageContentDraftRepository(prisma).findByProjectId(projectId);
  return NextResponse.json(drafts.map(toPageContentDraftDto));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.pageUrl !== "string" || body.pageUrl.trim().length === 0) {
    return NextResponse.json({ error: "pageUrl is required" }, { status: 400 });
  }

  const useCase = new GeneratePageContentDraftUseCase({
    crawlJobRepository: new PrismaCrawlJobRepository(prisma),
    pageRepository: new PrismaPageRepository(prisma),
    pageContentDraft: new DynamicPageContentDraftProvider(new PrismaLlmSettingsRepository(prisma)),
    pageContentDraftRepository: new PrismaPageContentDraftRepository(prisma),
  });

  const result = await useCase.execute(projectId, body.pageUrl);
  if (!result.ok) {
    const status = ERROR_STATUS[result.error.code] ?? 400;
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status });
  }

  return NextResponse.json(toPageContentDraftDto(result.value));
}
