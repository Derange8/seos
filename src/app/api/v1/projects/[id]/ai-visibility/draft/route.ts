import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { PrismaLlmSettingsRepository } from "@/infrastructure/persistence/prisma/prisma-llm-settings-repository";
import { DynamicAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/dynamic-ai-visibility-model";
import { PrismaAiVisibilityRunRepository } from "@/infrastructure/persistence/prisma/prisma-ai-visibility-run-repository";
import { PrismaVisibilityExperimentRepository } from "@/infrastructure/persistence/prisma/prisma-visibility-experiment-repository";
import { GenerateCitationContentUseCase } from "@/application/ai-visibility/use-cases/generate-citation-content-use-case";
import { StartVisibilityExperimentUseCase } from "@/application/ai-visibility/use-cases/start-visibility-experiment-use-case";
import { AiVisibilityProviderNotConfiguredError } from "@/application/ai-visibility/errors";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";
import { ConsoleLogger } from "@/infrastructure/logging/console-logger";

function sanitizeStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// POST (makes an LLM call) — drafts a citation-optimized page for one query,
// guided by the diagnosis gaps the client already fetched.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const payload = (body ?? {}) as Record<string, unknown>;
  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  if (query.length === 0) {
    return NextResponse.json({ error: "A query is required", code: "NO_QUERY" }, { status: 400 });
  }
  const gaps = sanitizeStringList(payload.gaps);

  const useCase = new GenerateCitationContentUseCase({
    projectRepository: new PrismaProjectRepository(prisma),
    model: new DynamicAiVisibilityModel(new PrismaLlmSettingsRepository(prisma), new ConsoleLogger()),
  });

  try {
    const draft = await useCase.execute(projectId, query, gaps);
    // Drafting is the observable "act" — open an experiment to track whether
    // this query's visibility moves by the next probe. Never let ledger
    // bookkeeping fail the draft the user asked for.
    try {
      await new StartVisibilityExperimentUseCase({
        runRepository: new PrismaAiVisibilityRunRepository(prisma),
        experimentRepository: new PrismaVisibilityExperimentRepository(prisma),
      }).execute(projectId, query);
    } catch (ledgerError) {
      console.error("Failed to open visibility experiment", ledgerError);
    }
    return NextResponse.json(draft);
  } catch (error) {
    if (error instanceof AiVisibilityProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error), code: "AI_VISIBILITY_DRAFT_FAILED" },
      { status: 502 }
    );
  }
}
