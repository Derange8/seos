import { ProjectNotFoundError } from "@/domain/projects/entities/project";
import type { Project } from "@/domain/projects/entities/project";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";
import { err, ok, type Result } from "@/shared/result";

export interface SetAutoPilotDeps {
  projectRepository: ProjectRepositoryPort;
}

// The on/off switch for "Otomatik Pilot" — turning this on doesn't start
// anything itself, it just makes the project eligible for the next
// AutoPilotScheduler tick (periodic re-crawl) and the next
// AutoApplyApprovedFixesUseCase run (auto-apply of already-safe fix
// types). See Project.autoPilotEnabled's own doc comment for what "safe"
// means today.
export class SetAutoPilotUseCase {
  constructor(private readonly deps: SetAutoPilotDeps) {}

  async execute(projectId: string, enabled: boolean): Promise<Result<Project, ProjectNotFoundError>> {
    const project = await this.deps.projectRepository.findById(projectId);
    if (!project) {
      return err(new ProjectNotFoundError(`Project "${projectId}" not found`));
    }

    project.setAutoPilotEnabled(enabled);
    await this.deps.projectRepository.save(project);

    return ok(project);
  }
}
