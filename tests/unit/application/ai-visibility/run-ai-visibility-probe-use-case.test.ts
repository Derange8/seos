import { describe, expect, it } from "vitest";
import { RunAiVisibilityProbeUseCase } from "@/application/ai-visibility/use-cases/run-ai-visibility-probe-use-case";
import type {
  AiVisibilityModelPort,
  AskResult,
  GroundingMode,
} from "@/application/ai-visibility/ports/ai-visibility-model-port";
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
  askModes: GroundingMode[] = [];
  async engineId(): Promise<string> {
    return "openai";
  }

  async ask(query: string, mode: GroundingMode): Promise<AskResult> {
    this.askModes.push(mode);
    return { answer: ANSWERS[query] ?? "", citations: [], groundingMode: mode };
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
  async generateCitationContent() {
    return { title: "", metaDescription: "", sections: [], faqs: [] };
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
  async findRecentByProjectId(): Promise<AiVisibilityProbeRun[]> {
    return [...this.saved].reverse();
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

    const run = await useCase.execute("project-1", TARGET, "parametric");

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

    const run = await useCase.execute("project-1", TARGET, "parametric");

    const contested = run.outcomes.find((o) => o.query === "q-contested");
    expect([...(contested?.competitorsMentioned ?? [])].sort()).toEqual(["Augur", "Polymarket"]);
  });

  it("only asks the model to judge when no self-mention and no known competitor matched", async () => {
    const model = new FakeModel();
    const runRepository = new FakeRunRepository();
    const useCase = new RunAiVisibilityProbeUseCase({ model, runRepository, samplesPerQuery: 1 });

    await useCase.execute("project-1", TARGET, "parametric");

    // Judge invoked for q-open and q-judged-contested only, not for the
    // mention/known-competitor queries.
    expect(model.judgeCalls).toHaveLength(2);
  });

  it("persists the run", async () => {
    const model = new FakeModel();
    const runRepository = new FakeRunRepository();
    const useCase = new RunAiVisibilityProbeUseCase({ model, runRepository, samplesPerQuery: 1 });

    const run = await useCase.execute("project-1", TARGET, "parametric");

    expect(runRepository.saved).toHaveLength(1);
    expect(runRepository.saved[0]).toBe(run);
  });

  it("retries a failed sample and still records a full outcome when the retry succeeds", async () => {
    const model = new FakeModel();
    // First ask throws, the retry succeeds — the sample must survive.
    let calls = 0;
    const original = model.ask.bind(model);
    model.ask = async (query: string, mode: GroundingMode) => {
      calls++;
      if (calls === 1) throw new Error("429 rate limited");
      return original(query, mode);
    };
    const runRepository = new FakeRunRepository();
    const useCase = new RunAiVisibilityProbeUseCase({
      model,
      runRepository,
      samplesPerQuery: 1,
      retriesPerSample: 1,
      retryDelayMs: 0,
    });

    const run = await useCase.execute("project-1", TARGET, "parametric");

    // All four queries still produce one slot each — nothing was lost.
    expect(run.outcomes).toHaveLength(4);
    expect(slotsFor(run, "q-contested")).toHaveLength(1);
  });

  it("drops a query whose every sample fails, keeps the rest, and saves the partial run", async () => {
    const model = new FakeModel();
    const original = model.ask.bind(model);
    // q-open fails on every attempt; the other three answer normally.
    model.ask = async (query: string, mode: GroundingMode) => {
      if (query === "q-open") throw new Error("timeout");
      return original(query, mode);
    };
    const runRepository = new FakeRunRepository();
    const useCase = new RunAiVisibilityProbeUseCase({
      model,
      runRepository,
      samplesPerQuery: 2,
      retriesPerSample: 1,
      retryDelayMs: 0,
    });

    const run = await useCase.execute("project-1", TARGET, "parametric");

    // q-open is dropped entirely (not recorded as a phantom CONTESTED), the
    // other three survive, and the partial run is still persisted.
    expect(run.outcomes.map((o) => o.query).sort()).toEqual([
      "q-contested",
      "q-judged-contested",
      "q-mentioned",
    ]);
    expect(runRepository.saved).toHaveLength(1);
  });

  it("passes the grounding mode through to the model and records it on the run", async () => {
    const model = new FakeModel();
    const runRepository = new FakeRunRepository();
    const useCase = new RunAiVisibilityProbeUseCase({ model, runRepository, samplesPerQuery: 1 });

    const run = await useCase.execute("project-1", TARGET, "web_grounded");

    expect(run.groundingMode).toBe("web_grounded");
    expect(model.askModes.every((m) => m === "web_grounded")).toBe(true);
  });

  it("counts a sample as cited when the answer cites the target domain, and unions sources", async () => {
    const model = new FakeModel();
    // Web-grounded answers carry citations; janus.vote is cited for q-mentioned
    // (a subdomain counts), a competitor is cited for q-contested.
    model.ask = async (query, mode) => {
      if (query === "q-mentioned") {
        return {
          answer: ANSWERS[query],
          citations: [
            { url: "https://blog.janus.vote/guide", title: "Janus guide" },
            { url: "https://polymarket.com" },
          ],
          groundingMode: mode,
        };
      }
      if (query === "q-contested") {
        return { answer: ANSWERS[query], citations: [{ url: "https://polymarket.com" }], groundingMode: mode };
      }
      return { answer: ANSWERS[query] ?? "", citations: [], groundingMode: mode };
    };
    const runRepository = new FakeRunRepository();
    const useCase = new RunAiVisibilityProbeUseCase({ model, runRepository, samplesPerQuery: 2 });

    const run = await useCase.execute("project-1", TARGET, "web_grounded");

    const mentioned = run.outcomes.find((o) => o.query === "q-mentioned");
    // Both samples cited janus.vote → citedSamples = 2, sources de-duped by url.
    expect(mentioned?.citedSamples).toBe(2);
    expect([...(mentioned?.citations ?? [])].map((c) => c.url).sort()).toEqual([
      "https://blog.janus.vote/guide",
      "https://polymarket.com",
    ]);

    // A competitor-only citation does not count as citing the target domain.
    const contested = run.outcomes.find((o) => o.query === "q-contested");
    expect(contested?.citedSamples).toBe(0);
  });

  it("throws and saves nothing when the whole probe measures zero samples", async () => {
    const model = new FakeModel();
    model.ask = async () => {
      throw new Error("provider down");
    };
    const runRepository = new FakeRunRepository();
    const useCase = new RunAiVisibilityProbeUseCase({
      model,
      runRepository,
      samplesPerQuery: 2,
      retriesPerSample: 0,
      retryDelayMs: 0,
    });

    await expect(useCase.execute("project-1", TARGET, "parametric")).rejects.toThrow("provider down");
    expect(runRepository.saved).toHaveLength(0);
  });
});
