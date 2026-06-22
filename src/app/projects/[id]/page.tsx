import { notFound } from "next/navigation";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { toProjectDto } from "@/application/projects/dto";
import { ProjectDashboard } from "@/components/project-dashboard";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await new PrismaProjectRepository(prisma).findById(id);
  if (!project) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <ProjectDashboard project={toProjectDto(project)} />
    </div>
  );
}
