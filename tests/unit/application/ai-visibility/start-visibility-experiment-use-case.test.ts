import { describe, expect, it, vi } from "vitest";
import { StartVisibilityExperimentUseCase } from "@/application/ai-visibility/use-cases/start-visibility-experiment-use-case";
import type { AiVisibilityRunRepositoryPort } from "@/application/ai-visibility/ports/ai-visibility-run-repository-port";
import { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";
import { FakeExperimentRepository } from "./experiment-fakes";

function runWith(query: string): AiVisibilityProbeRun {
  return AiVisibilityProbeRun.reconstitute({
    id: "r1",
    projectId: "p1",
    samplesPerQuery: 2,
    runAt: new Date("2026-07-01"),
    outcomes: [{ query, slots: ["CONTESTED", "CONTESTED"], competitorsMentioned: ["Polymarket"] }],
  });
}

function runRepo(run: AiVisibilityProbeRun | null): AiVisibilityRunRepositoryPort {
  return {
    save: vi.fn(),
    findLatestByProjectId: vi.fn().mockResolvedValue(run),
    findRecentByProjectId: vi.fn().mockResolvedValue(run ? [run] : []),
  };
}

describe("StartVisibilityExperimentUseCase", () => {
  it("opens an experiment with the query's current slot as the baseline", async () => {
    const experimentRepository = new FakeExperimentRepository();
    const useCase = new StartVisibilityExperimentUseCase({
      runRepository: runRepo(runWith("q1")),
      experimentRepository,
    });

    const experiment = await useCase.execute("p1", "q1");

    expect(experiment?.baselineSlot).toBe("CONTESTED");
    expect(experiment?.status).toBe("OPEN");
    expect(experimentRepository.saved).toHaveLength(1);
  });

  it("does not open a duplicate when one is already tracking the query", async () => {
    const experimentRepository = new FakeExperimentRepository();
    const useCase = new StartVisibilityExperimentUseCase({
      runRepository: runRepo(runWith("q1")),
      experimentRepository,
    });

    const first = await useCase.execute("p1", "q1");
    const second = await useCase.execute("p1", "q1");

    expect(second?.id).toBe(first?.id);
    expect(experimentRepository.saved).toHaveLength(1);
  });

  it("returns null when no run has measured the query yet", async () => {
    const useCase = new StartVisibilityExperimentUseCase({
      runRepository: runRepo(null),
      experimentRepository: new FakeExperimentRepository(),
    });

    expect(await useCase.execute("p1", "q1")).toBeNull();
  });
});
