import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { PrismaRobotsRepository } from "@/infrastructure/persistence/prisma/prisma-robots-repository";
import { GetOrGenerateRobotsFileUseCase } from "@/application/robots/use-cases/get-or-generate-robots-file-use-case";
import { toRobotsFileDto } from "@/application/robots/dto";
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

  const useCase = new GetOrGenerateRobotsFileUseCase({ robotsRepository: new PrismaRobotsRepository(prisma) });
  const robotsFile = await useCase.execute(project.id, project.domain);

  return NextResponse.json(toRobotsFileDto(robotsFile));
}
