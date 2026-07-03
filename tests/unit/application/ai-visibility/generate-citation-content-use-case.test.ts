import { describe, expect, it, vi } from "vitest";
import { GenerateCitationContentUseCase } from "@/application/ai-visibility/use-cases/generate-citation-content-use-case";
import type {
  AiVisibilityModelPort,
  CitationContentInput,
} from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";
import { Project } from "@/domain/projects/entities/project";
import { DomainName } from "@/domain/projects/value-objects/domain-name";

function domain(value: string): DomainName {
  const result = DomainName.create(value);
  if (!result.ok) throw new Error("expected ok domain");
  return result.value;
}

class CapturingModel implements AiVisibilityModelPort {
  lastInput: CitationContentInput | null = null;
  async ask(): Promise<string> {
    return "";
  }
  async namesSpecificOption(): Promise<boolean> {
    return false;
  }
  async suggestProbeTarget() {
    return { queries: [], competitors: [] };
  }
  async diagnoseVisibilityGap(): Promise<string[]> {
    return [];
  }
  async generateCitationContent(input: CitationContentInput) {
    this.lastInput = input;
    return { title: "Drafted", metaDescription: "m", sections: [], faqs: [] };
  }
}

function projectRepo(project: Project | null): ProjectRepositoryPort {
  return {
    findById: vi.fn().mockResolvedValue(project),
    save: vi.fn(),
    findByDomain: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
  };
}

describe("GenerateCitationContentUseCase", () => {
  it("passes the project brand/domain plus the query and gaps to the model", async () => {
    const project = Project.create("Janus", domain("janus.vote"));
    const model = new CapturingModel();
    const useCase = new GenerateCitationContentUseCase({ projectRepository: projectRepo(project), model });

    const draft = await useCase.execute(project.id, "best prediction market", ["Add a comparison page"]);

    expect(draft.title).toBe("Drafted");
    expect(model.lastInput?.brand).toBe("Janus");
    expect(model.lastInput?.domain).toBe("janus.vote");
    expect(model.lastInput?.query).toBe("best prediction market");
    expect(model.lastInput?.gaps).toEqual(["Add a comparison page"]);
  });

  it("throws when the project does not exist", async () => {
    const useCase = new GenerateCitationContentUseCase({ projectRepository: projectRepo(null), model: new CapturingModel() });
    await expect(useCase.execute("missing", "q", [])).rejects.toThrow(/not found/);
  });
});
