import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaWordPressConnectionRepository } from "@/infrastructure/persistence/prisma/prisma-wordpress-connection-repository";
import { WordPressRestApiClient } from "@/infrastructure/wordpress/wordpress-rest-api-client";
import { PublishCitationContentUseCase } from "@/application/ai-visibility/use-cases/publish-citation-content-use-case";
import type { CitationDraft } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";
import { shouldAllowPrivateNetworks } from "@/infrastructure/config/allow-private-networks";

const ERROR_STATUS: Record<string, number> = {
  WORDPRESS_NOT_CONNECTED: 409,
  WORDPRESS_UNAUTHORIZED: 401,
  WORDPRESS_POST_NOT_FOUND: 404,
  WORDPRESS_UNREACHABLE: 502,
  WORDPRESS_BLOCKED_PRIVATE_NETWORK: 400,
};

function isCitationDraft(value: unknown): value is CitationDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.title === "string" &&
    typeof draft.metaDescription === "string" &&
    Array.isArray(draft.sections) &&
    Array.isArray(draft.faqs)
  );
}

// POST — pushes a client-held CitationDraft (see GenerateCitationContentUseCase
// — on-demand, never persisted server-side, so the caller sends the full
// draft body back rather than referencing it by id) to WordPress as a new
// draft page.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const draft = (body as { draft?: unknown } | null)?.draft;
  if (!isCitationDraft(draft)) {
    return NextResponse.json({ error: "A valid citation draft is required", code: "INVALID_DRAFT" }, { status: 400 });
  }

  const useCase = new PublishCitationContentUseCase({
    wordPressConnectionRepository: new PrismaWordPressConnectionRepository(prisma),
    wordPressClient: new WordPressRestApiClient({ allowPrivateNetworks: shouldAllowPrivateNetworks() }),
  });

  const result = await useCase.execute(projectId, draft);
  if (!result.ok) {
    const status = ERROR_STATUS[result.error.code] ?? 400;
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status });
  }

  return NextResponse.json(result.value);
}
