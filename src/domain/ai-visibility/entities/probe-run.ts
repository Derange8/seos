import type { Slot } from "@/domain/ai-visibility/slot";
import type { Citation, GroundingMode } from "@/application/ai-visibility/ports/ai-visibility-model-port";

// One query's result within a probe run: the slot of each of the N samples
// (kept, not collapsed — the distribution is the honest signal) plus the
// union of competitors seen across those samples.
export interface QueryOutcome {
  query: string;
  slots: readonly Slot[];
  competitorsMentioned: readonly string[];
  // Web-grounded signal, parallel to `slots`: in how many of this query's
  // samples the answer cited the target's own domain. Always 0 for a
  // parametric run (no web search, no sources) — an honest reading, not a gap.
  citedSamples: number;
  // The distinct sources seen across this query's samples (union). Populated
  // only in web_grounded mode; the "evidence" the dashboard drills into.
  citations: readonly Citation[];
}

export interface AiVisibilityProbeRunProps {
  id: string;
  projectId: string;
  samplesPerQuery: number;
  // How the whole run was measured. Recorded so a trend never silently
  // compares a parametric run against a web-grounded one (different surfaces).
  groundingMode: GroundingMode;
  // Which AI engine measured this run (e.g. "openai", "anthropic"). Different
  // engines are different answer surfaces — a site can be recommended on one
  // and invisible on another — so runs are labeled with it and a trend/delta
  // never silently compares across engines. Plain string, not tied to the
  // settings LlmProvider enum, so the domain doesn't depend on settings.
  engine: string;
  runAt: Date;
  outcomes: QueryOutcome[];
}

// A generated-artifact entity (like SitemapFile/SeoScore), not an aggregate
// root — no state machine, one row per run, kept as history via runAt so the
// dashboard can show an AI-visibility trend over time.
export class AiVisibilityProbeRun {
  private constructor(private readonly props: AiVisibilityProbeRunProps) {}

  static create(
    projectId: string,
    samplesPerQuery: number,
    groundingMode: GroundingMode,
    engine: string
  ): AiVisibilityProbeRun {
    return new AiVisibilityProbeRun({
      id: crypto.randomUUID(),
      projectId,
      samplesPerQuery,
      groundingMode,
      engine,
      runAt: new Date(),
      outcomes: [],
    });
  }

  static reconstitute(props: AiVisibilityProbeRunProps): AiVisibilityProbeRun {
    return new AiVisibilityProbeRun({ ...props, outcomes: [...props.outcomes] });
  }

  addOutcome(outcome: QueryOutcome): void {
    this.props.outcomes.push(outcome);
  }

  get id(): string {
    return this.props.id;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get samplesPerQuery(): number {
    return this.props.samplesPerQuery;
  }

  get groundingMode(): GroundingMode {
    return this.props.groundingMode;
  }

  get engine(): string {
    return this.props.engine;
  }

  get runAt(): Date {
    return this.props.runAt;
  }

  get outcomes(): readonly QueryOutcome[] {
    return this.props.outcomes;
  }
}
