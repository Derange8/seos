import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaPageContentDraftRepository } from "@/infrastructure/persistence/prisma/prisma-page-content-draft-repository";
import { PrismaWordPressConnectionRepository } from "@/infrastructure/persistence/prisma/prisma-wordpress-connection-repository";
import { WordPressRestApiClient } from "@/infrastructure/wordpress/wordpress-rest-api-client";
import { RevertPageContentDraftUseCase } from "@/application/wordpress/use-cases/revert-page-content-draft-use-case";
import { toPageContentDraftDto } from "@/application/content-enrichment/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";
import { shouldAllowPrivateNetworks } from "@/infrastructure/config/allow-private-networks";

const ERROR_STATUS: Record<string, number> = {
  PAGE_CONTENT_DRAFT_NOT_FOUND: 404,
  PAGE_CONTENT_DRAFT_NOT_PUBLISHED: 409,
  WORDPRESS_NOT_CONNECTED: 409,
  WORDPRESS_UNAUTHORIZED: 401,
  WORDPRESS_POST_NOT_FOUND: 404,
  WORDPRESS_UNREACHABLE: 502,
  WORDPRESS_BLOCKED_PRIVATE_NETWORK: 400,
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; draftId: string }> }
) {
  const { id: projectId, draftId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const useCase = new RevertPageContentDraftUseCase({
    pageContentDraftRepository: new PrismaPageContentDraftRepository(prisma),
    wordPressConnectionRepository: new PrismaWordPressConnectionRepository(prisma),
    wordPressClient: new WordPressRestApiClient({ allowPrivateNetworks: shouldAllowPrivateNetworks() }),
  });

  const result = await useCase.execute(projectId, draftId);
  if (!result.ok) {
    const status = ERROR_STATUS[result.error.code] ?? 400;
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status });
  }

  return NextResponse.json(toPageContentDraftDto(result.value));
}
