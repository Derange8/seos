import type { Slot } from "@/domain/ai-visibility/slot";

// One query's result within a probe run: the slot of each of the N samples
// (kept, not collapsed — the distribution is the honest signal) plus the
// union of competitors seen across those samples.
export interface QueryOutcome {
  query: string;
  slots: readonly Slot[];
  competitorsMentioned: readonly string[];
}

export interface AiVisibilityProbeRunProps {
  id: string;
  projectId: string;
  samplesPerQuery: number;
  runAt: Date;
  outcomes: QueryOutcome[];
}

// A generated-artifact entity (like SitemapFile/SeoScore), not an aggregate
// root — no state machine, one row per run, kept as history via runAt so the
// dashboard can show an AI-visibility trend over time.
export class AiVisibilityProbeRun {
  private constructor(private readonly props: AiVisibilityProbeRunProps) {}

  static create(projectId: string, samplesPerQuery: number): AiVisibilityProbeRun {
    return new AiVisibilityProbeRun({
      id: crypto.randomUUID(),
      projectId,
      samplesPerQuery,
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

  get runAt(): Date {
    return this.props.runAt;
  }

  get outcomes(): readonly QueryOutcome[] {
    return this.props.outcomes;
  }
}
