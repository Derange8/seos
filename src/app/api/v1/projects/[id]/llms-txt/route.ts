import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaLlmsTxtRepository } from "@/infrastructure/persistence/prisma/prisma-llms-txt-repository";
import { toLlmsTxtFileDto } from "@/application/llms-txt/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireProjectAccess(id);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const llmsTxtFile = await new PrismaLlmsTxtRepository(prisma).findLatestByProjectId(id);
  if (!llmsTxtFile) {
    return NextResponse.json({ error: "No llms.txt generated for this project yet" }, { status: 404 });
  }

  return NextResponse.json(toLlmsTxtFileDto(llmsTxtFile));
}
