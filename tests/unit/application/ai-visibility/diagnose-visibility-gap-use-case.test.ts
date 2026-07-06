import { describe, expect, it, vi } from "vitest";
import { DiagnoseVisibilityGapUseCase } from "@/application/ai-visibility/use-cases/diagnose-visibility-gap-use-case";
import type {
  AiVisibilityModelPort,
  AskResult,
  GroundingMode,
  VisibilityGapInput,
} from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { AiVisibilityRunRepositoryPort } from "@/application/ai-visibility/ports/ai-visibility-run-repository-port";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";
import { Project } from "@/domain/projects/entities/project";
import { DomainName } from "@/domain/projects/value-objects/domain-name";
import { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";

function domain(value: string): DomainName {
  const result = DomainName.create(value);
  if (!result.ok) throw new Error("expected ok domain");
  return result.value;
}

class CapturingModel implements AiVisibilityModelPort {
  lastInput: VisibilityGapInput | null = null;
  async engineId(): Promise<string> {
    return "openai";
  }

  async ask(_query: string, mode: GroundingMode): Promise<AskResult> {
    return { answer: "", citations: [], groundingMode: mode };
  }
  async namesSpecificOption(): Promise<boolean> {
    return false;
  }
  async suggestProbeTarget() {
    return { queries: [], competitors: [] };
  }
  async diagnoseVisibilityGap(input: VisibilityGapInput): Promise<string[]> {
    this.lastInput = input;
    return ["Add a comparison page"];
  }
  async generateCitationContent() {
    return { title: "", metaDescription: "", sections: [], faqs: [] };
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

function runRepo(run: AiVisibilityProbeRun | null): AiVisibilityRunRepositoryPort {
  return {
    save: vi.fn(),
    findLatestByProjectId: vi.fn().mockResolvedValue(run),
    findRecentByProjectId: vi.fn().mockResolvedValue(run ? [run] : []),
  };
}

describe("DiagnoseVisibilityGapUseCase", () => {
  it("grounds the diagnosis in the competitors the latest run saw for that query", async () => {
    const project = Project.create("Janus", domain("janus.vote"));
    const run = AiVisibilityProbeRun.reconstitute({
      id: "r1",
      projectId: project.id,
      samplesPerQuery: 2,
      groundingMode: "parametric",
      engine: "openai",
      runAt: new Date(),
      outcomes: [{ query: "best prediction market", slots: ["CONTESTED"], competitorsMentioned: ["Polymarket", "Augur"], citedSamples: 0, citations: [] }],
    });
    const model = new CapturingModel();

    const useCase = new DiagnoseVisibilityGapUseCase({
      projectRepository: projectRepo(project),
      runRepository: runRepo(run),
      model,
    });

    const gaps = await useCase.execute(project.id, "best prediction market");

    expect(gaps).toEqual(["Add a comparison page"]);
    expect(model.lastInput?.brand).toBe("Janus");
    expect(model.lastInput?.competitors).toEqual(["Polymarket", "Augur"]);
  });

  it("passes empty competitors when there is no prior run for the query", async () => {
    const project = Project.create("Janus", domain("janus.vote"));
    const model = new CapturingModel();

    const useCase = new DiagnoseVisibilityGapUseCase({
      projectRepository: projectRepo(project),
      runRepository: runRepo(null),
      model,
    });

    await useCase.execute(project.id, "some query");

    expect(model.lastInput?.competitors).toEqual([]);
  });

  it("throws when the project does not exist", async () => {
    const useCase = new DiagnoseVisibilityGapUseCase({
      projectRepository: projectRepo(null),
      runRepository: runRepo(null),
      model: new CapturingModel(),
    });

    await expect(useCase.execute("missing", "q")).rejects.toThrow(/not found/);
  });
});
