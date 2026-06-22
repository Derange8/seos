import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaAuditRunRepository } from "@/infrastructure/persistence/prisma/prisma-audit-run-repository";
import { PrismaPageRepository } from "@/infrastructure/persistence/prisma/prisma-page-repository";
import { ComputeAuditDeltaUseCase } from "@/application/delta-audit/use-cases/compute-audit-delta-use-case";
import { toAuditDeltaDto } from "@/application/delta-audit/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const access = await requireProjectAccess(projectId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const useCase = new ComputeAuditDeltaUseCase({
    auditRunRepository: new PrismaAuditRunRepository(prisma),
    pageRepository: new PrismaPageRepository(prisma),
  });

  const delta = await useCase.execute(projectId);
  // null is a normal state (the project's first crawl has nothing to
  // compare against yet), not an error — 200 with a null body, not 404.
  return NextResponse.json(delta ? toAuditDeltaDto(delta) : null);
}
