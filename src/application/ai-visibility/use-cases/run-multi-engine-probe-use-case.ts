import type { AiVisibilityModelPort, GroundingMode } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { AiVisibilityRunRepositoryPort } from "@/application/ai-visibility/ports/ai-visibility-run-repository-port";
import type { LlmCredentialRepositoryPort } from "@/application/settings/ports/llm-credential-repository-port";
import type { LlmProvider } from "@/domain/settings/entities/llm-settings";
import type { ProbeTarget } from "@/domain/ai-visibility/entities/probe-target";
import type { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";
import { RunAiVisibilityProbeUseCase } from "@/application/ai-visibility/use-cases/run-ai-visibility-probe-use-case";
import type { Logger } from "@/shared/logger";

export interface MultiEngineProbeResult {
  // One saved probe run per engine that measured successfully.
  runs: AiVisibilityProbeRun[];
  // Engines that were asked to measure but failed (bad key, quota, provider
  // down) — surfaced so the UI can say "Gemini couldn't be measured" rather
  // than silently omitting it.
  failed: { engine: LlmProvider; error: string }[];
}

// Builds a probe model for one provider+key. Injected so the use case stays
// infrastructure-free (the route passes createAiVisibilityModel).
export type AiVisibilityModelFactory = (
  provider: LlmProvider,
  apiKey: string,
  model: string | null
) => AiVisibilityModelPort;

export interface RunMultiEngineProbeDeps {
  credentialRepository: LlmCredentialRepositoryPort;
  runRepository: AiVisibilityRunRepositoryPort;
  modelFactory: AiVisibilityModelFactory;
  samplesPerQuery?: number;
  maxSamplesPerQuery?: number;
  logger?: Logger;
}

// Measures the same target on several AI engines at once — the whole point of
// "AI visibility": a site can be recommended on ChatGPT and invisible on
// Gemini. Fans out one single-engine probe per configured credential in
// PARALLEL (they're independent network-bound calls) and tolerates partial
// failure: one engine's bad key or quota must not sink the others, so each
// engine's outcome is captured separately.
export class RunMultiEngineProbeUseCase {
  constructor(private readonly deps: RunMultiEngineProbeDeps) {}

  // `engines` optionally restricts to a subset; omitted → every configured
  // credential. Each engine produces its own AiVisibilityProbeRun (the run
  // already carries `engine`, so they're distinguishable and never compared
  // across engines by the delta's sameEngine guard).
  async execute(
    projectId: string,
    target: ProbeTarget,
    mode: GroundingMode,
    engines?: LlmProvider[]
  ): Promise<MultiEngineProbeResult> {
    const all = await this.deps.credentialRepository.findAll();
    const selected = engines ? all.filter((c) => engines.includes(c.provider)) : all;

    const settled = await Promise.allSettled(
      selected.map(async (cred) => {
        const model = this.deps.modelFactory(cred.provider, cred.apiKey, cred.model);
        const probe = new RunAiVisibilityProbeUseCase({
          model,
          runRepository: this.deps.runRepository,
          samplesPerQuery: this.deps.samplesPerQuery,
          maxSamplesPerQuery: this.deps.maxSamplesPerQuery,
          logger: this.deps.logger,
        });
        return { provider: cred.provider, run: await probe.execute(projectId, target, mode) };
      })
    );

    const runs: AiVisibilityProbeRun[] = [];
    const failed: { engine: LlmProvider; error: string }[] = [];
    settled.forEach((result, i) => {
      if (result.status === "fulfilled") {
        runs.push(result.value.run);
      } else {
        const engine = selected[i].provider;
        const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
        this.deps.logger?.warn("Multi-engine probe: an engine failed", { engine, error });
        failed.push({ engine, error });
      }
    });

    return { runs, failed };
  }
}
