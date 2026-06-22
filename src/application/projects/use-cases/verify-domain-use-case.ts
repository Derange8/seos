import { ProjectNotFoundError } from "@/domain/projects/entities/project";
import type { Project } from "@/domain/projects/entities/project";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";
import type { DomainOwnershipPort } from "@/application/projects/ports/domain-ownership-port";
import { err, ok, type Result } from "@/shared/result";

export interface VerifyDomainDeps {
  projectRepository: ProjectRepositoryPort;
  domainOwnership: DomainOwnershipPort;
}

export class VerifyDomainUseCase {
  constructor(private readonly deps: VerifyDomainDeps) {}

  async execute(projectId: string): Promise<Result<Project, ProjectNotFoundError>> {
    const { projectRepository, domainOwnership } = this.deps;

    const project = await projectRepository.findById(projectId);
    if (!project) {
      return err(new ProjectNotFoundError(`Project "${projectId}" not found`));
    }
    if (project.isVerified) {
      return ok(project);
    }

    let isVerified = await domainOwnership.checkDnsTxtRecord(
      project.dnsTxtRecordName,
      project.verificationToken
    );
    if (!isVerified) {
      isVerified = await domainOwnership.checkWellKnownFile(
        project.wellKnownFileUrl,
        project.verificationToken
      );
    }

    if (isVerified) {
      project.markVerified();
      await projectRepository.save(project);
    }

    return ok(project);
  }
}
