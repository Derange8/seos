import { describe, expect, it } from "vitest";
import { RunAiVisibilityProbeUseCase } from "@/application/ai-visibility/use-cases/run-ai-visibility-probe-use-case";
import type { AiVisibilityModelPort } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { AiVisibilityRunRepositoryPort } from "@/application/ai-visibility/ports/ai-visibility-run-repository-port";
import type { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";
import type { ProbeTarget } from "@/domain/ai-visibility/entities/probe-target";

const TARGET: ProbeTarget = {
  brand: "Janus",
  domain: "janus.vote",
  aliases: ["janus", "janus.vote"],
  competitors: ["Polymarket", "Augur"],
  queries: ["q-contested", "q-mentioned", "q-open", "q-judged-contested"],
};

// Deterministic canned answer per query.
const ANSWERS: Record<string, string> = {
  "q-contested": "Polymarket ve Augur öneririm.",
  "q-mentioned": "janus.vote tam aradığın şey.",
  "q-open": "Çeşitli genel platformlar var, net bir isim yok.",
  "q-judged-contested": "SomeUnknownBrand adında bir platform var.",
};

class FakeModel implements AiVisibilityModelPort {
  judgeCalls: string[] = [];
  async ask(query: string): Promise<string> {
    return ANSWERS[query] ?? "";
  }
  async namesSpecificOption(answer: string): Promise<boolean> {
    this.judgeCalls.push(answer);
    // Only the unknown-brand answer names a specific option.
    return answer.includes("SomeUnknownBrand");
  }
  async suggestProbeTarget(): Promise<{ queries: string[]; competitors: string[] }> {
    return { queries: [], competitors: [] };
  }
  async diagnoseVisibilityGap(): Promise<string[]> {
    return [];
  }
}

class FakeRunRepository implements AiVisibilityRunRepositoryPort {
  saved: AiVisibilityProbeRun[] = [];
  async save(run: AiVisibilityProbeRun): Promise<void> {
    this.saved.push(run);
  }
  async findLatestByProjectId(): Promise<AiVisibilityProbeRun | null> {
    return this.saved[this.saved.length - 1] ?? null;
  }
}

function slotsFor(run: AiVisibilityProbeRun, query: string) {
  return run.outcomes.find((o) => o.query === query)?.slots ?? [];
}

describe("RunAiVisibilityProbeUseCase", () => {
  it("classifies each query's slot from the model's answers and samples N times", async () => {
    const model = new FakeModel();
    const runRepository = new FakeRunRepository();
    const useCase = new RunAiVisibilityProbeUseCase({ model, runRepository, samplesPerQuery: 3 });

    const run = await useCase.execute("project-1", TARGET);

    expect(run.outcomes).toHaveLength(4);
    expect(slotsFor(run, "q-contested")).toEqual(["CONTESTED", "CONTESTED", "CONTESTED"]);
    expect(slotsFor(run, "q-mentioned")).toEqual(["MENTIONED", "MENTIONED", "MENTIONED"]);
    expect(slotsFor(run, "q-open")).toEqual(["OPEN", "OPEN", "OPEN"]);
    expect(slotsFor(run, "q-judged-contested")).toEqual(["CONTESTED", "CONTESTED", "CONTESTED"]);
  });

  it("records the union of competitors seen for a query", async () => {
    const model = new FakeModel();
    const runRepository = new FakeRunRepository();
    const useCase = new RunAiVisibilityProbeUseCase({ model, runRepository, samplesPerQuery: 2 });

    const run = await useCase.execute("project-1", TARGET);

    const contested = run.outcomes.find((o) => o.query === "q-contested");
    expect([...(contested?.competitorsMentioned ?? [])].sort()).toEqual(["Augur", "Polymarket"]);
  });

  it("only asks the model to judge when no self-mention and no known competitor matched", async () => {
    const model = new FakeModel();
    const runRepository = new FakeRunRepository();
    const useCase = new RunAiVisibilityProbeUseCase({ model, runRepository, samplesPerQuery: 1 });

    await useCase.execute("project-1", TARGET);

    // Judge invoked for q-open and q-judged-contested only, not for the
    // mention/known-competitor queries.
    expect(model.judgeCalls).toHaveLength(2);
  });

  it("persists the run", async () => {
    const model = new FakeModel();
    const runRepository = new FakeRunRepository();
    const useCase = new RunAiVisibilityProbeUseCase({ model, runRepository, samplesPerQuery: 1 });

    const run = await useCase.execute("project-1", TARGET);

    expect(runRepository.saved).toHaveLength(1);
    expect(runRepository.saved[0]).toBe(run);
  });
});
