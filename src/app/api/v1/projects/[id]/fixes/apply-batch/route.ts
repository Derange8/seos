import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaFixCandidateRepository } from "@/infrastructure/persistence/prisma/prisma-fix-candidate-repository";
import { PrismaPageRepository } from "@/infrastructure/persistence/prisma/prisma-page-repository";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { PrismaWordPressConnectionRepository } from "@/infrastructure/persistence/prisma/prisma-wordpress-connection-repository";
import { WordPressRestApiClient } from "@/infrastructure/wordpress/wordpress-rest-api-client";
import { ApplyFixCandidatesUseCase } from "@/application/wordpress/use-cases/apply-fix-candidates-use-case";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";
import { shouldAllowPrivateNetworks } from "@/infrastructure/config/allow-private-networks";

// "Fix All" for one rule/route-template group — same per-candidate
// semantics as the single POST .../fixes/[fixId]/apply (isolation check,
// SUPPORTED_FIX_TYPES, FAILED-not-stuck-DRAFT), just applied to a list.
// Always 200s with per-item results rather than one overall status code —
// a batch is expected to partially fail (see ApplyFixCandidatesUseCase).
const MAX_BATCH_SIZE = 200;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const payload = (body ?? {}) as Record<string, unknown>;
  const fixCandidateIds = Array.isArray(payload.fixCandidateIds)
    ? payload.fixCandidateIds.filter((id): id is string => typeof id === "string")
    : [];

  if (fixCandidateIds.length === 0) {
    return NextResponse.json({ error: "At least one fixCandidateId is required", code: "NO_FIX_CANDIDATES" }, { status: 400 });
  }
  if (fixCandidateIds.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `At most ${MAX_BATCH_SIZE} fix candidates can be applied in one batch`, code: "BATCH_TOO_LARGE" },
      { status: 400 }
    );
  }

  const useCase = new ApplyFixCandidatesUseCase({
    fixCandidateRepository: new PrismaFixCandidateRepository(prisma),
    pageRepository: new PrismaPageRepository(prisma),
    crawlJobRepository: new PrismaCrawlJobRepository(prisma),
    wordPressConnectionRepository: new PrismaWordPressConnectionRepository(prisma),
    wordPressClient: new WordPressRestApiClient({ allowPrivateNetworks: shouldAllowPrivateNetworks() }),
  });

  const results = await useCase.execute(projectId, fixCandidateIds);
  return NextResponse.json({ results });
}
