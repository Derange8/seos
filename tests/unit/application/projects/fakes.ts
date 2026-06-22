import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";
import type { DomainOwnershipPort } from "@/application/projects/ports/domain-ownership-port";
import type { Project } from "@/domain/projects/entities/project";

export class FakeProjectRepository implements ProjectRepositoryPort {
  readonly saved: Project[] = [];
  private readonly byId = new Map<string, Project>();

  seed(project: Project): void {
    this.byId.set(project.id, project);
  }

  async save(project: Project): Promise<void> {
    this.byId.set(project.id, project);
    this.saved.push(project);
  }

  async findById(id: string): Promise<Project | null> {
    return this.byId.get(id) ?? null;
  }

  async findByDomain(domain: string): Promise<Project | null> {
    return [...this.byId.values()].find((project) => project.domain.value === domain) ?? null;
  }

  async findAll(): Promise<Project[]> {
    return [...this.byId.values()];
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }
}

export class FakeDomainOwnershipPort implements DomainOwnershipPort {
  dnsResult = false;
  fileResult = false;
  readonly dnsChecks: Array<{ recordName: string; expectedValue: string }> = [];
  readonly fileChecks: Array<{ fileUrl: string; expectedValue: string }> = [];

  async checkDnsTxtRecord(recordName: string, expectedValue: string): Promise<boolean> {
    this.dnsChecks.push({ recordName, expectedValue });
    return this.dnsResult;
  }

  async checkWellKnownFile(fileUrl: string, expectedValue: string): Promise<boolean> {
    this.fileChecks.push({ fileUrl, expectedValue });
    return this.fileResult;
  }
}
