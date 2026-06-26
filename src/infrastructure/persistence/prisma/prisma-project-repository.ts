import type { PrismaClient, Project as PrismaProjectRow } from "@/generated/prisma/client";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";
import { Project, type ProjectProps } from "@/domain/projects/entities/project";
import { DomainName } from "@/domain/projects/value-objects/domain-name";

function toDomain(row: PrismaProjectRow): Project {
  const domainResult = DomainName.create(row.domain);
  if (!domainResult.ok) {
    throw new Error(`Project "${row.id}" has a corrupt persisted domain "${row.domain}": ${domainResult.error.message}`);
  }

  const props: ProjectProps = {
    id: row.id,
    name: row.name,
    domain: domainResult.value,
    verificationToken: row.verificationToken,
    domainVerifiedAt: row.domainVerifiedAt,
    autoPilotEnabled: row.autoPilotEnabled,
  };

  return Project.reconstitute(props);
}

export class PrismaProjectRepository implements ProjectRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async save(project: Project): Promise<void> {
    const data = { domainVerifiedAt: project.domainVerifiedAt, autoPilotEnabled: project.autoPilotEnabled };

    await this.client.project.upsert({
      where: { id: project.id },
      create: {
        id: project.id,
        name: project.name,
        domain: project.domain.value,
        verificationToken: project.verificationToken,
        ...data,
      },
      update: data,
    });
  }

  async findById(id: string): Promise<Project | null> {
    const row = await this.client.project.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByDomain(domain: string): Promise<Project | null> {
    const row = await this.client.project.findUnique({ where: { domain } });
    return row ? toDomain(row) : null;
  }

  async findAll(): Promise<Project[]> {
    const rows = await this.client.project.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toDomain);
  }

  async delete(id: string): Promise<void> {
    await this.client.project.delete({ where: { id } });
  }
}
