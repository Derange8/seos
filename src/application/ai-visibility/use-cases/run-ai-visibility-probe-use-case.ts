import { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";
import type { ProbeTarget } from "@/domain/ai-visibility/entities/probe-target";
import type { Slot } from "@/domain/ai-visibility/slot";
import { detectCompetitors, detectMention, isConfident } from "@/domain/ai-visibility/slot";
import { citesDomain } from "@/domain/ai-visibility/citation";
import type {
  AiVisibilityModelPort,
  Citation,
  GroundingMode,
} from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { AiVisibilityRunRepositoryPort } from "@/application/ai-visibility/ports/ai-visibility-run-repository-port";
import type { Logger } from "@/shared/logger";

export interface RunAiVisibilityProbeDeps {
  model: AiVisibilityModelPort;
  runRepository: AiVisibilityRunRepositoryPort;
  // Each query is asked this many times; the slot of a query is a
  // distribution over samples, not a single reading (LLM answers vary run to
  // run — a single shot flips OPEN/CONTESTED unreliably).
  samplesPerQuery?: number;
  // The MINIMUM samples a query gets; sampling then continues adaptively up to
  // maxSamplesPerQuery until the reading is confident (see isConfident). Kept as
  // the historical field name — it's now the floor, not a fixed count.
  //
  // maxSamplesPerQuery caps the adaptive growth. Defaults to samplesPerQuery,
  // i.e. adaptive sampling is OFF unless a caller asks for headroom — a stable
  // query stops at the min (cheaper), an uncertain one spends up to the max.
  maxSamplesPerQuery?: number;
  // How many extra attempts a single sample gets if its model call throws
  // (transient 429/timeout/network blip). 0 disables retries.
  retriesPerSample?: number;
  // Delay between a failed sample and its retry. Injectable so tests run at 0.
  retryDelayMs?: number;
  logger?: Logger;
}

const DEFAULT_SAMPLES = 4;
const DEFAULT_RETRIES_PER_SAMPLE = 1;
const DEFAULT_RETRY_DELAY_MS = 500;

// One successful reading of a query: its slot, the competitors the answer
// named, whether the answer cited the target's own domain, and the raw
// sources it cited (for the union rolled up onto the query outcome).
interface SampleResult {
  slot: Slot;
  competitors: string[];
  citedDomain: boolean;
  citations: Citation[];
}

type SampleAttempt = { ok: true; result: SampleResult } | { ok: false; error: unknown };

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Measures how AI answer engines position a business for its buyer-intent
// queries. A probe fires dozens of live model calls (queries × samples × up to
// 2); a single transient failure must not throw away every reading taken so
// far. So sample failures are tolerated: a failed sample is retried then
// dropped, a fully-failed query is skipped, and the partial run is still saved
// — the scorecard denominator is the samples actually taken, so dropping some
// stays honest. Only a run that measured *nothing* throws (no junk 0% row).
export class RunAiVisibilityProbeUseCase {
  private readonly samplesPerQuery: number;
  private readonly maxSamplesPerQuery: number;
  private readonly retriesPerSample: number;
  private readonly retryDelayMs: number;

  constructor(private readonly deps: RunAiVisibilityProbeDeps) {
    this.samplesPerQuery = deps.samplesPerQuery ?? DEFAULT_SAMPLES;
    // Never below the min; defaults to the min (adaptive off) when unset.
    this.maxSamplesPerQuery = Math.max(this.samplesPerQuery, deps.maxSamplesPerQuery ?? this.samplesPerQuery);
    this.retriesPerSample = deps.retriesPerSample ?? DEFAULT_RETRIES_PER_SAMPLE;
    this.retryDelayMs = deps.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  async execute(
    projectId: string,
    target: ProbeTarget,
    mode: GroundingMode
  ): Promise<AiVisibilityProbeRun> {
    // Which engine is measuring this run — recorded so the run is labeled by,
    // and never compared across, its answer surface.
    const engine = await this.deps.model.engineId();
    const run = AiVisibilityProbeRun.create(projectId, this.samplesPerQuery, mode, engine);
    let lastError: unknown = null;

    for (const query of target.queries) {
      const slots: Slot[] = [];
      const competitors = new Set<string>();
      let citedSamples = 0;
      // De-dupe sources by URL across this query's samples for the union we
      // surface as "evidence".
      const citationsByUrl = new Map<string, Citation>();

      // Adaptive sampling: take at least samplesPerQuery, then keep going up to
      // maxSamplesPerQuery only while the reading is still uncertain — a stable
      // query stops at the min (no wasted calls), a split one spends more budget
      // until it either becomes confident or hits the max. `attempts` counts
      // every call (successes AND failures) against the max so a query whose
      // samples keep throwing can't loop forever.
      let attempts = 0;
      while (attempts < this.maxSamplesPerQuery) {
        // Stop early once we have the minimum AND a confident reading.
        if (slots.length >= this.samplesPerQuery && isConfident(slots)) break;

        attempts++;
        const attempt = await this.sample(query, target, mode);
        if (!attempt.ok) {
          lastError = attempt.error;
          continue;
        }
        for (const c of attempt.result.competitors) competitors.add(c);
        if (attempt.result.citedDomain) citedSamples++;
        for (const c of attempt.result.citations) {
          if (!citationsByUrl.has(c.url)) citationsByUrl.set(c.url, c);
        }
        slots.push(attempt.result.slot);
      }

      // Every sample for this query threw — don't record a phantom outcome
      // (dominantSlot([]) is CONTESTED, which would read as "a competitor is
      // recommended" when the truth is "we failed to measure it").
      if (slots.length === 0) {
        this.deps.logger?.warn("AI visibility: query dropped, all samples failed", { query });
        continue;
      }

      run.addOutcome({
        query,
        slots,
        competitorsMentioned: [...competitors],
        citedSamples,
        citations: [...citationsByUrl.values()],
      });
    }

    if (run.outcomes.length === 0) {
      // The whole probe measured nothing (e.g. bad key, provider down). Surface
      // the real error instead of persisting a junk all-zero run as a trend point.
      throw lastError instanceof Error
        ? lastError
        : new Error("AI visibility probe produced no measurable samples");
    }

    await this.deps.runRepository.save(run);
    return run;
  }

  // One sample = one `ask` + its classification, with bounded retries. Returns
  // the last error rather than throwing so the caller can drop just this sample.
  private async sample(
    query: string,
    target: ProbeTarget,
    mode: GroundingMode
  ): Promise<SampleAttempt> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.retriesPerSample; attempt++) {
      try {
        const { answer, citations } = await this.deps.model.ask(query, mode);
        const slot = await this.classify(answer, target);
        return {
          ok: true,
          result: {
            slot,
            competitors: detectCompetitors(answer, target.competitors),
            citedDomain: citesDomain(citations, target.domain),
            citations,
          },
        };
      } catch (error) {
        lastError = error;
        this.deps.logger?.warn("AI visibility: sample attempt failed", {
          query,
          attempt: attempt + 1,
          error: error instanceof Error ? error.message : String(error),
        });
        if (attempt < this.retriesPerSample && this.retryDelayMs > 0) await sleep(this.retryDelayMs);
      }
    }
    return { ok: false, error: lastError };
  }

  private async classify(answer: string, target: ProbeTarget): Promise<Slot> {
    if (detectMention(answer, target.aliases)) return "MENTIONED";
    if (detectCompetitors(answer, target.competitors).length > 0) return "CONTESTED";
    // No known brand matched — ask the model whether it named ANY specific
    // platform, to catch competitors outside the known list before calling
    // this a genuinely open slot.
    return (await this.deps.model.namesSpecificOption(answer)) ? "CONTESTED" : "OPEN";
  }
}
