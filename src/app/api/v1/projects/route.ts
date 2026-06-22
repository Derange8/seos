import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { CreateProjectUseCase } from "@/application/projects/use-cases/create-project-use-case";
import { toProjectDto } from "@/application/projects/dto";

export async function GET() {
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(
    projects.map((project) => ({
      id: project.id,
      name: project.name,
      domain: project.domain,
      isVerified: project.domainVerifiedAt !== null,
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || typeof body.domain !== "string") {
    return NextResponse.json({ error: "name and domain are required" }, { status: 400 });
  }

  const useCase = new CreateProjectUseCase({
    projectRepository: new PrismaProjectRepository(prisma),
  });

  const result = await useCase.execute(body.name, body.domain);
  if (!result.ok) {
    const status = result.error.code === "DOMAIN_ALREADY_EXISTS" ? 409 : 400;
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status });
  }

  return NextResponse.json(toProjectDto(result.value), { status: 201 });
}
