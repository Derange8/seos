import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { PrismaAiVisibilityRunRepository } from "@/infrastructure/persistence/prisma/prisma-ai-visibility-run-repository";
import { PrismaLlmCredentialRepository } from "@/infrastructure/persistence/prisma/prisma-llm-credential-repository";
import { PrismaVisibilityExperimentRepository } from "@/infrastructure/persistence/prisma/prisma-visibility-experiment-repository";
import { RunMultiEngineProbeUseCase } from "@/application/ai-visibility/use-cases/run-multi-engine-probe-use-case";
import { ResolveVisibilityExperimentsUseCase } from "@/application/ai-visibility/use-cases/resolve-visibility-experiments-use-case";
import { createAiVisibilityModel, isMeasurementEngine } from "@/infrastructure/llm/ai-visibility/create-ai-visibility-model";
import { toMultiEngineComparisonDto } from "@/application/ai-visibility/dto";
import type { ProbeTarget } from "@/domain/ai-visibility/entities/probe-target";
import type { GroundingMode } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";
import { ConsoleLogger } from "@/infrastructure/logging/console-logger";

const MAX_QUERIES = 20;
const MAX_SAMPLES = 5;
const DEFAULT_SAMPLES = 3;

function sanitizeStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter((s) => s.length > 0);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// POST — measures the same target on several engines at once (Faz 5.5). Each
// engine that has a stored key produces its own probe run; the response is the
// side-by-side comparison plus any engines that failed.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const project = await new PrismaProjectRepository(prisma).findById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const payload = (body ?? {}) as Record<string, unknown>;
  const queries = sanitizeStringList(payload.queries).slice(0, MAX_QUERIES);
  if (queries.length === 0) {
    return NextResponse.json({ error: "At least one query is required", code: "NO_QUERIES" }, { status: 400 });
  }
  const competitors = sanitizeStringList(payload.competitors);
  const samplesPerQuery = clamp(Number(payload.samplesPerQuery) || DEFAULT_SAMPLES, 1, MAX_SAMPLES);
  const maxSamplesPerQuery = clamp(Number(payload.maxSamplesPerQuery) || MAX_SAMPLES, samplesPerQuery, MAX_SAMPLES);
  const groundingMode: GroundingMode = payload.groundingMode === "parametric" ? "parametric" : "web_grounded";
  // Optional engine subset; only measurement engines are honored.
  const engines = sanitizeStringList(payload.engines).filter((e) => isMeasurementEngine(e as LlmProvider)) as LlmProvider[];

  const domain = project.domain.value;
  const firstLabel = domain.split(".")[0] ?? domain;
  const target: ProbeTarget = {
    brand: project.name,
    domain,
    aliases: [...new Set([project.name, domain, firstLabel].filter((s) => s.length > 0))],
    competitors,
    queries,
  };

  const runRepository = new PrismaAiVisibilityRunRepository(prisma);
  const useCase = new RunMultiEngineProbeUseCase({
    credentialRepository: new PrismaLlmCredentialRepository(prisma),
    runRepository,
    modelFactory: createAiVisibilityModel,
    samplesPerQuery,
    maxSamplesPerQuery,
    logger: new ConsoleLogger(),
  });

  const { runs, failed } = await useCase.execute(
    projectId,
    target,
    groundingMode,
    engines.length > 0 ? engines : undefined
  );

  if (runs.length === 0) {
    // No engine measured — either no credentials configured, or all failed.
    return NextResponse.json(
      { error: "No engine could measure — configure at least one measurement engine key.", code: "NO_ENGINES", failed },
      { status: 409 }
    );
  }

  // Each fresh run resolves any open experiments for its own engine's queries.
  // Never let ledger bookkeeping fail the probe.
  const resolve = new ResolveVisibilityExperimentsUseCase({
    experimentRepository: new PrismaVisibilityExperimentRepository(prisma),
  });
  for (const run of runs) {
    try {
      await resolve.execute(projectId, run);
    } catch (ledgerError) {
      console.error("Failed to resolve visibility experiments", ledgerError);
    }
  }

  return NextResponse.json(toMultiEngineComparisonDto(runs, failed));
}
