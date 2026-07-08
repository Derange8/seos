import { describe, expect, it, vi } from "vitest";
import { RunMultiEngineProbeUseCase } from "@/application/ai-visibility/use-cases/run-multi-engine-probe-use-case";
import type { AiVisibilityModelPort, AskResult, GroundingMode } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { AiVisibilityRunRepositoryPort } from "@/application/ai-visibility/ports/ai-visibility-run-repository-port";
import type { LlmCredentialRepositoryPort } from "@/application/settings/ports/llm-credential-repository-port";
import { LlmCredential } from "@/domain/settings/entities/llm-credential";
import type { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";
import type { ProbeTarget } from "@/domain/ai-visibility/entities/probe-target";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";

const TARGET: ProbeTarget = {
  brand: "Janus",
  domain: "janus.vote",
  aliases: ["janus", "janus.vote"],
  competitors: ["Polymarket"],
  queries: ["best market"],
};

// A model whose engineId is the provider it was built for, answering a fixed
// slot so runs are deterministic. Optionally throws (to test partial failure).
function fakeModel(engine: string, opts: { throwOnAsk?: boolean } = {}): AiVisibilityModelPort {
  return {
    engineId: async () => engine,
    ask: async (_q: string, mode: GroundingMode): Promise<AskResult> => {
      if (opts.throwOnAsk) throw new Error(`${engine} down`);
      return { answer: "janus.vote is great", citations: [], groundingMode: mode };
    },
    namesSpecificOption: async () => false,
    suggestProbeTarget: async () => ({ queries: [], competitors: [] }),
    diagnoseVisibilityGap: async () => [],
    generateCitationContent: async () => ({ title: "", metaDescription: "", sections: [], faqs: [] }),
  };
}

function credRepo(providers: LlmProvider[]): LlmCredentialRepositoryPort {
  return {
    upsert: vi.fn(),
    remove: vi.fn(),
    findAll: vi.fn().mockResolvedValue(providers.map((p) => LlmCredential.create(p, "key", null))),
  };
}

function runRepo(): AiVisibilityRunRepositoryPort {
  const saved: AiVisibilityProbeRun[] = [];
  return {
    save: vi.fn(async (r: AiVisibilityProbeRun) => {
      saved.push(r);
    }),
    findLatestByProjectId: async () => saved[saved.length - 1] ?? null,
    findRecentByProjectId: async () => [...saved].reverse(),
  };
}

describe("RunMultiEngineProbeUseCase", () => {
  it("fans out one run per configured engine, each stamped with its engine", async () => {
    const useCase = new RunMultiEngineProbeUseCase({
      credentialRepository: credRepo(["openai", "anthropic", "gemini"]),
      runRepository: runRepo(),
      modelFactory: (provider) => fakeModel(provider),
      samplesPerQuery: 1,
      maxSamplesPerQuery: 1,
    });

    const { runs, failed } = await useCase.execute("p1", TARGET, "web_grounded");

    expect(runs.map((r) => r.engine).sort()).toEqual(["anthropic", "gemini", "openai"]);
    expect(failed).toEqual([]);
  });

  it("tolerates one engine failing — the others still measure", async () => {
    const useCase = new RunMultiEngineProbeUseCase({
      credentialRepository: credRepo(["openai", "gemini"]),
      runRepository: runRepo(),
      modelFactory: (provider) => fakeModel(provider, { throwOnAsk: provider === "gemini" }),
      samplesPerQuery: 1,
      maxSamplesPerQuery: 1,
    });

    const { runs, failed } = await useCase.execute("p1", TARGET, "web_grounded");

    expect(runs.map((r) => r.engine)).toEqual(["openai"]);
    expect(failed).toEqual([{ engine: "gemini", error: "gemini down" }]);
  });

  it("restricts to the requested engine subset", async () => {
    const useCase = new RunMultiEngineProbeUseCase({
      credentialRepository: credRepo(["openai", "anthropic", "gemini"]),
      runRepository: runRepo(),
      modelFactory: (provider) => fakeModel(provider),
      samplesPerQuery: 1,
      maxSamplesPerQuery: 1,
    });

    const { runs } = await useCase.execute("p1", TARGET, "web_grounded", ["gemini"]);

    expect(runs.map((r) => r.engine)).toEqual(["gemini"]);
  });

  it("returns empty runs (no throw) when nothing is configured", async () => {
    const useCase = new RunMultiEngineProbeUseCase({
      credentialRepository: credRepo([]),
      runRepository: runRepo(),
      modelFactory: (provider) => fakeModel(provider),
    });

    const { runs, failed } = await useCase.execute("p1", TARGET, "web_grounded");

    expect(runs).toEqual([]);
    expect(failed).toEqual([]);
  });
});
