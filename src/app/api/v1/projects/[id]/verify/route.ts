import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { DomainOwnershipChecker } from "@/infrastructure/verification/domain-ownership-checker";
import { VerifyDomainUseCase } from "@/application/projects/use-cases/verify-domain-use-case";
import { toProjectDto } from "@/application/projects/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireProjectAccess(id);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const useCase = new VerifyDomainUseCase({
    projectRepository: new PrismaProjectRepository(prisma),
    domainOwnership: new DomainOwnershipChecker(),
  });

  const result = await useCase.execute(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status: 404 });
  }

  return NextResponse.json(toProjectDto(result.value));
}
