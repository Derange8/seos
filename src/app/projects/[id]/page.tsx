import { notFound } from "next/navigation";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { toProjectDto } from "@/application/projects/dto";
import { ProjectDashboard } from "@/components/project-dashboard";
import { AppShell } from "@/components/app-shell";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await new PrismaProjectRepository(prisma).findById(id);
  if (!project) notFound();

  return (
    <AppShell active="sites">
      <ProjectDashboard project={toProjectDto(project)} />
    </AppShell>
  );
}
