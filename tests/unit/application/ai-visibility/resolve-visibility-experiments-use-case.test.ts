import { describe, expect, it } from "vitest";
import { ResolveVisibilityExperimentsUseCase } from "@/application/ai-visibility/use-cases/resolve-visibility-experiments-use-case";
import { AiVisibilityProbeRun, type QueryOutcome } from "@/domain/ai-visibility/entities/probe-run";
import { VisibilityExperiment } from "@/domain/ai-visibility/entities/visibility-experiment";
import { FakeExperimentRepository } from "./experiment-fakes";

function laterRun(outcomes: QueryOutcome[]): AiVisibilityProbeRun {
  // Well after any actionAt (which is new() at start time).
  return AiVisibilityProbeRun.reconstitute({
    id: "r2",
    projectId: "p1",
    samplesPerQuery: 2,
    groundingMode: "parametric",
    runAt: new Date(Date.now() + 86_400_000),
    outcomes,
  });
}

describe("ResolveVisibilityExperimentsUseCase", () => {
  it("resolves an open experiment whose query the new run re-measured", async () => {
    const experimentRepository = new FakeExperimentRepository();
    await experimentRepository.save(VisibilityExperiment.start("p1", "q1", "CONTESTED", new Date("2026-07-01")));
    const useCase = new ResolveVisibilityExperimentsUseCase({ experimentRepository });

    await useCase.execute("p1", laterRun([{ query: "q1", slots: ["MENTIONED", "MENTIONED"], competitorsMentioned: [], citedSamples: 0, citations: [] }]));

    const [resolved] = await experimentRepository.findByProjectId("p1");
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.outcome).toBe("IMPROVED");
  });

  it("leaves an experiment open when the run doesn't cover its query", async () => {
    const experimentRepository = new FakeExperimentRepository();
    await experimentRepository.save(VisibilityExperiment.start("p1", "q1", "CONTESTED", new Date("2026-07-01")));
    const useCase = new ResolveVisibilityExperimentsUseCase({ experimentRepository });

    await useCase.execute("p1", laterRun([{ query: "other", slots: ["OPEN"], competitorsMentioned: [], citedSamples: 0, citations: [] }]));

    expect(await experimentRepository.findOpenByProjectId("p1")).toHaveLength(1);
  });

  it("does not resolve with a run at or before the action time", async () => {
    const experimentRepository = new FakeExperimentRepository();
    await experimentRepository.save(VisibilityExperiment.start("p1", "q1", "CONTESTED", new Date("2026-07-01")));
    const useCase = new ResolveVisibilityExperimentsUseCase({ experimentRepository });

    // A run dated in the past (before actionAt = now) must not count as a re-measure.
    const pastRun = AiVisibilityProbeRun.reconstitute({
      id: "r0",
      projectId: "p1",
      samplesPerQuery: 1,
      groundingMode: "parametric",
      runAt: new Date("2026-06-01"),
      outcomes: [{ query: "q1", slots: ["MENTIONED"], competitorsMentioned: [], citedSamples: 0, citations: [] }],
    });
    await useCase.execute("p1", pastRun);

    expect(await experimentRepository.findOpenByProjectId("p1")).toHaveLength(1);
  });
});
