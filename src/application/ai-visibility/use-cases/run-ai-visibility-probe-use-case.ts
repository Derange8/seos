import { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";
import type { QueryOutcome } from "@/domain/ai-visibility/entities/probe-run";
import type { ProbeTarget } from "@/domain/ai-visibility/entities/probe-target";
import type { Slot } from "@/domain/ai-visibility/slot";
import { detectCompetitors, detectMention } from "@/domain/ai-visibility/slot";
import type { AiVisibilityModelPort } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { AiVisibilityRunRepositoryPort } from "@/application/ai-visibility/ports/ai-visibility-run-repository-port";

export interface RunAiVisibilityProbeDeps {
  model: AiVisibilityModelPort;
  runRepository: AiVisibilityRunRepositoryPort;
  // Each query is asked this many times; the slot of a query is a
  // distribution over samples, not a single reading (LLM answers vary run to
  // run — a single shot flips OPEN/CONTESTED unreliably).
  samplesPerQuery?: number;
}

const DEFAULT_SAMPLES = 4;

// Measures how AI answer engines position a business for its buyer-intent
// queries. No expected-failure branch — any target just produces a run (even
// a degenerate all-OPEN one), so it returns the run directly, not a Result.
export class RunAiVisibilityProbeUseCase {
  private readonly samplesPerQuery: number;

  constructor(private readonly deps: RunAiVisibilityProbeDeps) {
    this.samplesPerQuery = deps.samplesPerQuery ?? DEFAULT_SAMPLES;
  }

  async execute(projectId: string, target: ProbeTarget): Promise<AiVisibilityProbeRun> {
    const run = AiVisibilityProbeRun.create(projectId, this.samplesPerQuery);

    for (const query of target.queries) {
      const slots: Slot[] = [];
      const competitors = new Set<string>();

      for (let i = 0; i < this.samplesPerQuery; i++) {
        const answer = await this.deps.model.ask(query);
        for (const c of detectCompetitors(answer, target.competitors)) competitors.add(c);
        slots.push(await this.classify(answer, target));
      }

      const outcome: QueryOutcome = { query, slots, competitorsMentioned: [...competitors] };
      run.addOutcome(outcome);
    }

    await this.deps.runRepository.save(run);
    return run;
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
