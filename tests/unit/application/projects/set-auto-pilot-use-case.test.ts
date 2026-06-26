import { describe, expect, it } from "vitest";
import { SetAutoPilotUseCase } from "@/application/projects/use-cases/set-auto-pilot-use-case";
import { Project } from "@/domain/projects/entities/project";
import { DomainName } from "@/domain/projects/value-objects/domain-name";
import { FakeProjectRepository } from "./fakes";

function domain(input: string): DomainName {
  const result = DomainName.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("SetAutoPilotUseCase", () => {
  it("returns an error when the project does not exist", async () => {
    const projectRepository = new FakeProjectRepository();
    const useCase = new SetAutoPilotUseCase({ projectRepository });

    const result = await useCase.execute("missing", true);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("turns autoPilotEnabled on and persists it", async () => {
    const projectRepository = new FakeProjectRepository();
    const project = Project.create("Site", domain("example.com"));
    projectRepository.seed(project);
    const useCase = new SetAutoPilotUseCase({ projectRepository });

    const result = await useCase.execute(project.id, true);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.autoPilotEnabled).toBe(true);
    const reloaded = await projectRepository.findById(project.id);
    expect(reloaded?.autoPilotEnabled).toBe(true);
  });

  it("turns autoPilotEnabled back off and persists it", async () => {
    const projectRepository = new FakeProjectRepository();
    const project = Project.create("Site", domain("example.com"));
    project.setAutoPilotEnabled(true);
    projectRepository.seed(project);
    const useCase = new SetAutoPilotUseCase({ projectRepository });

    const result = await useCase.execute(project.id, false);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.autoPilotEnabled).toBe(false);
  });
});
