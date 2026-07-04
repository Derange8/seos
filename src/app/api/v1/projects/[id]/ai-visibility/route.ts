import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { PrismaAiVisibilityRunRepository } from "@/infrastructure/persistence/prisma/prisma-ai-visibility-run-repository";
import { PrismaLlmSettingsRepository } from "@/infrastructure/persistence/prisma/prisma-llm-settings-repository";
import { DynamicAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/dynamic-ai-visibility-model";
import { PrismaVisibilityExperimentRepository } from "@/infrastructure/persistence/prisma/prisma-visibility-experiment-repository";
import { RunAiVisibilityProbeUseCase } from "@/application/ai-visibility/use-cases/run-ai-visibility-probe-use-case";
import { ResolveVisibilityExperimentsUseCase } from "@/application/ai-visibility/use-cases/resolve-visibility-experiments-use-case";
import { AiVisibilityProviderNotConfiguredError } from "@/application/ai-visibility/errors";
import { toAiVisibilityRunDto } from "@/application/ai-visibility/dto";
import type { ProbeTarget } from "@/domain/ai-visibility/entities/probe-target";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";
import { ConsoleLogger } from "@/infrastructure/logging/console-logger";

const MAX_QUERIES = 20;
const MAX_SAMPLES = 5;
const DEFAULT_SAMPLES = 3;

function sanitizeStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// Read-only view of the latest stored probe run (or null) — separate from
// POST, which actually queries the model. Same GET/POST split as content-ideas.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const recent = await new PrismaAiVisibilityRunRepository(prisma).findRecentByProjectId(projectId, 2);
  if (recent.length === 0) return NextResponse.json(null);
  return NextResponse.json(toAiVisibilityRunDto(recent[0], recent[1] ?? null));
}

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
  const useCase = new RunAiVisibilityProbeUseCase({
    model: new DynamicAiVisibilityModel(new PrismaLlmSettingsRepository(prisma), new ConsoleLogger()),
    runRepository,
    samplesPerQuery,
    logger: new ConsoleLogger(),
  });

  try {
    const run = await useCase.execute(projectId, target);
    // A fresh probe is the re-measure that resolves any open experiments for
    // the queries it covered. Never let ledger bookkeeping fail the probe.
    try {
      await new ResolveVisibilityExperimentsUseCase({
        experimentRepository: new PrismaVisibilityExperimentRepository(prisma),
      }).execute(projectId, run);
    } catch (ledgerError) {
      console.error("Failed to resolve visibility experiments", ledgerError);
    }
    // The run just saved is the newest; the one before it is the baseline to
    // show movement against.
    const recent = await runRepository.findRecentByProjectId(projectId, 2);
    const previous = recent.find((r) => r.id !== run.id) ?? null;
    return NextResponse.json(toAiVisibilityRunDto(run, previous));
  } catch (error) {
    if (error instanceof AiVisibilityProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error), code: "AI_VISIBILITY_PROBE_FAILED" },
      { status: 502 }
    );
  }
}
