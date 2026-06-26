import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { toProjectDto } from "@/application/projects/dto";
import { SetAutoPilotUseCase } from "@/application/projects/use-cases/set-auto-pilot-use-case";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireProjectAccess(id);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const project = await new PrismaProjectRepository(prisma).findById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(toProjectDto(project));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireProjectAccess(id);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body.autoPilotEnabled !== "boolean") {
    return NextResponse.json({ error: "autoPilotEnabled must be a boolean" }, { status: 400 });
  }

  const useCase = new SetAutoPilotUseCase({ projectRepository: new PrismaProjectRepository(prisma) });
  const result = await useCase.execute(id, body.autoPilotEnabled);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 404 });
  }

  return NextResponse.json(toProjectDto(result.value));
}

// "Disconnect this site" — cascades to every row that hangs off this
// project (crawl jobs, pages, audit runs, WordPress/Google connections,
// etc.) per schema.prisma's onDelete: Cascade relations. Irreversible.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireProjectAccess(id);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await new PrismaProjectRepository(prisma).delete(id);
  return new NextResponse(null, { status: 204 });
}
