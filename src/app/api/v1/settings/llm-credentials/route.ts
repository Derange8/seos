import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaLlmCredentialRepository } from "@/infrastructure/persistence/prisma/prisma-llm-credential-repository";
import { LlmCredentialValidator } from "@/infrastructure/llm/llm-credential-validator";
import { ManageLlmCredentialsUseCase } from "@/application/settings/use-cases/manage-llm-credentials-use-case";
import { MEASUREMENT_ENGINES, isMeasurementEngine } from "@/infrastructure/llm/ai-visibility/create-ai-visibility-model";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";

const ERROR_STATUS: Record<string, number> = {
  EMPTY_LLM_CREDENTIAL_KEY: 400,
  INVALID_LLM_API_KEY: 400,
};

function buildUseCase() {
  return new ManageLlmCredentialsUseCase({
    credentialRepository: new PrismaLlmCredentialRepository(prisma),
    validator: new LlmCredentialValidator(),
  });
}

// The per-engine measurement keys (Faz 5.5), app-level like the single
// LlmSettings. GET returns only which engines are configured — never the keys.
export async function GET() {
  const providers = await buildUseCase().listProviders();
  return NextResponse.json({ configured: providers, available: MEASUREMENT_ENGINES });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  if (typeof body.provider !== "string" || !isMeasurementEngine(body.provider as LlmProvider)) {
    return NextResponse.json(
      { error: `provider must be a measurement engine: ${MEASUREMENT_ENGINES.join(", ")}` },
      { status: 400 }
    );
  }
  if (typeof body.apiKey !== "string") {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }
  const model = typeof body.model === "string" && body.model.trim().length > 0 ? body.model : null;

  const result = await buildUseCase().save(body.provider as LlmProvider, body.apiKey, model);
  if (!result.ok) {
    const status = ERROR_STATUS[result.error.code] ?? 400;
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status });
  }

  return NextResponse.json({ provider: result.value.provider }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const provider = new URL(request.url).searchParams.get("provider");
  if (!provider || !isMeasurementEngine(provider as LlmProvider)) {
    return NextResponse.json({ error: "a valid ?provider= is required" }, { status: 400 });
  }
  await buildUseCase().remove(provider as LlmProvider);
  return new NextResponse(null, { status: 204 });
}
