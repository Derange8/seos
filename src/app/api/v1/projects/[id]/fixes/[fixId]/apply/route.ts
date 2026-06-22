import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaFixCandidateRepository } from "@/infrastructure/persistence/prisma/prisma-fix-candidate-repository";
import { PrismaPageRepository } from "@/infrastructure/persistence/prisma/prisma-page-repository";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { PrismaWordPressConnectionRepository } from "@/infrastructure/persistence/prisma/prisma-wordpress-connection-repository";
import { WordPressRestApiClient } from "@/infrastructure/wordpress/wordpress-rest-api-client";
import { ApplyFixCandidateUseCase } from "@/application/wordpress/use-cases/apply-fix-candidate-use-case";
import { toFixCandidateDto } from "@/application/fixes/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";
import { shouldAllowPrivateNetworks } from "@/infrastructure/config/allow-private-networks";

const ERROR_STATUS: Record<string, number> = {
  FIX_CANDIDATE_NOT_FOUND: 404,
  UNSUPPORTED_FIX_TYPE: 400,
  WORDPRESS_NOT_CONNECTED: 409,
  FIX_CANDIDATE_ALREADY_APPLIED: 409,
  WORDPRESS_UNAUTHORIZED: 401,
  WORDPRESS_POST_NOT_FOUND: 404,
  WORDPRESS_UNREACHABLE: 502,
  WORDPRESS_BLOCKED_PRIVATE_NETWORK: 400,
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; fixId: string }> }
) {
  const { id: projectId, fixId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const useCase = new ApplyFixCandidateUseCase({
    fixCandidateRepository: new PrismaFixCandidateRepository(prisma),
    pageRepository: new PrismaPageRepository(prisma),
    crawlJobRepository: new PrismaCrawlJobRepository(prisma),
    wordPressConnectionRepository: new PrismaWordPressConnectionRepository(prisma),
    wordPressClient: new WordPressRestApiClient({ allowPrivateNetworks: shouldAllowPrivateNetworks() }),
  });

  const result = await useCase.execute(projectId, fixId);
  if (!result.ok) {
    const status = ERROR_STATUS[result.error.code] ?? 400;
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status });
  }

  return NextResponse.json(toFixCandidateDto(result.value));
}
