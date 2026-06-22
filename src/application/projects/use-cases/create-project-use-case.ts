import { Project } from "@/domain/projects/entities/project";
import { DomainName, type InvalidDomainNameError } from "@/domain/projects/value-objects/domain-name";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class DomainAlreadyExistsError extends DomainError {
  readonly code = "DOMAIN_ALREADY_EXISTS";
}

export class InvalidProjectNameError extends DomainError {
  readonly code = "INVALID_PROJECT_NAME";
}

const MAX_NAME_LENGTH = 200;

export interface CreateProjectDeps {
  projectRepository: ProjectRepositoryPort;
}

// Multiple projects/sites are supported (see project-list.tsx) — the only
// real constraint is that each tracks a distinct domain, since "domain" is
// how every other piece of the app (verification, crawling) identifies
// which site a project is.
export class CreateProjectUseCase {
  constructor(private readonly deps: CreateProjectDeps) {}

  async execute(
    name: string,
    domainInput: string
  ): Promise<Result<Project, InvalidDomainNameError | InvalidProjectNameError | DomainAlreadyExistsError>> {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return err(new InvalidProjectNameError("name must not be empty"));
    }
    if (trimmedName.length > MAX_NAME_LENGTH) {
      return err(new InvalidProjectNameError(`name must be at most ${MAX_NAME_LENGTH} characters`));
    }

    const domainResult = DomainName.create(domainInput);
    if (!domainResult.ok) return domainResult;

    const existing = await this.deps.projectRepository.findByDomain(domainResult.value.value);
    if (existing) {
      return err(new DomainAlreadyExistsError(`a project for "${domainResult.value.value}" already exists`));
    }

    const project = Project.create(trimmedName, domainResult.value);
    await this.deps.projectRepository.save(project);

    return ok(project);
  }
}
