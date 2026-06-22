import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaLlmSettingsRepository } from "@/infrastructure/persistence/prisma/prisma-llm-settings-repository";
import { LlmCredentialValidator } from "@/infrastructure/llm/llm-credential-validator";
import { SaveLlmSettingsUseCase } from "@/application/settings/use-cases/save-llm-settings-use-case";
import { toLlmSettingsDto } from "@/application/settings/dto";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";

const VALID_PROVIDERS: readonly LlmProvider[] = ["openai", "anthropic", "deepseek"];

const ERROR_STATUS: Record<string, number> = {
  EMPTY_LLM_API_KEY: 400,
  INVALID_LLM_API_KEY: 400,
};

// App-level, not project-scoped — there's exactly one LlmSettings row per
// install (see schema.prisma), same way there's exactly one Project.
export async function GET() {
  const settings = await new PrismaLlmSettingsRepository(prisma).find();
  return NextResponse.json(settings ? toLlmSettingsDto(settings) : null);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  if (typeof body.provider !== "string" || !VALID_PROVIDERS.includes(body.provider as LlmProvider)) {
    return NextResponse.json({ error: `provider must be one of: ${VALID_PROVIDERS.join(", ")}` }, { status: 400 });
  }
  if (typeof body.apiKey !== "string") {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }
  const model = typeof body.model === "string" && body.model.trim().length > 0 ? body.model : null;

  const useCase = new SaveLlmSettingsUseCase({
    llmCredentialValidator: new LlmCredentialValidator(),
    llmSettingsRepository: new PrismaLlmSettingsRepository(prisma),
  });

  const result = await useCase.execute(body.provider as LlmProvider, body.apiKey, model);
  if (!result.ok) {
    const status = ERROR_STATUS[result.error.code] ?? 400;
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status });
  }

  return NextResponse.json(toLlmSettingsDto(result.value), { status: 201 });
}

export async function DELETE() {
  await new PrismaLlmSettingsRepository(prisma).clear();
  return new NextResponse(null, { status: 204 });
}
