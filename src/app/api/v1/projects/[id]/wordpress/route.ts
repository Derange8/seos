import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaWordPressConnectionRepository } from "@/infrastructure/persistence/prisma/prisma-wordpress-connection-repository";
import { WordPressRestApiClient } from "@/infrastructure/wordpress/wordpress-rest-api-client";
import { ConnectWordPressUseCase } from "@/application/wordpress/use-cases/connect-wordpress-use-case";
import { toWordPressConnectionDto } from "@/application/wordpress/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";
import { shouldAllowPrivateNetworks } from "@/infrastructure/config/allow-private-networks";

const ERROR_STATUS: Record<string, number> = {
  INVALID_SITE_URL: 400,
  INVALID_WORDPRESS_CREDENTIALS: 400,
  WORDPRESS_UNAUTHORIZED: 401,
  WORDPRESS_POST_NOT_FOUND: 404,
  WORDPRESS_UNREACHABLE: 502,
  WORDPRESS_BLOCKED_PRIVATE_NETWORK: 400,
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const connection = await new PrismaWordPressConnectionRepository(prisma).findByProjectId(projectId);
  return NextResponse.json(connection ? toWordPressConnectionDto(connection) : null);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  if (typeof body.siteUrl !== "string" || typeof body.username !== "string" || typeof body.applicationPassword !== "string") {
    return NextResponse.json({ error: "siteUrl, username, and applicationPassword are all required" }, { status: 400 });
  }

  const useCase = new ConnectWordPressUseCase({
    wordPressClient: new WordPressRestApiClient({ allowPrivateNetworks: shouldAllowPrivateNetworks() }),
    wordPressConnectionRepository: new PrismaWordPressConnectionRepository(prisma),
  });

  const result = await useCase.execute(projectId, body.siteUrl, body.username, body.applicationPassword);
  if (!result.ok) {
    const status = ERROR_STATUS[result.error.code] ?? 400;
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status });
  }

  return NextResponse.json(toWordPressConnectionDto(result.value), { status: 201 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await new PrismaWordPressConnectionRepository(prisma).deleteByProjectId(projectId);
  return new NextResponse(null, { status: 204 });
}
