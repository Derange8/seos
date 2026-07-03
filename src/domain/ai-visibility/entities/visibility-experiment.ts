import type { Slot } from "@/domain/ai-visibility/slot";
import { SLOT_RANK } from "@/domain/ai-visibility/slot";

export type ExperimentStatus = "OPEN" | "RESOLVED";

// Whether the query's position moved forward, back, or not at all between the
// baseline and the post-action re-measure. Honest label: this is observed
// correlation over time, not proven causation — the app can't verify the user
// actually published the drafted content.
export type ExperimentOutcome = "IMPROVED" | "UNCHANGED" | "REGRESSED";

export function classifyOutcome(baseline: Slot, outcome: Slot): ExperimentOutcome {
  const diff = SLOT_RANK[outcome] - SLOT_RANK[baseline];
  return diff > 0 ? "IMPROVED" : diff < 0 ? "REGRESSED" : "UNCHANGED";
}

export interface VisibilityExperimentProps {
  id: string;
  projectId: string;
  query: string;
  baselineSlot: Slot;
  // When the baseline slot was observed (the probe run it came from).
  baselineRunAt: Date;
  // When the user acted (drafted citation content for this query).
  actionAt: Date;
  status: ExperimentStatus;
  outcomeSlot: Slot | null;
  outcomeRunAt: Date | null;
}

// One tracked "did acting on this query move its AI visibility?" record — the
// local learning substrate a future collective model would aggregate. Opened
// when content is drafted for a query, resolved by the next probe run that
// re-measures that query.
export class VisibilityExperiment {
  private constructor(private readonly props: VisibilityExperimentProps) {}

  static start(projectId: string, query: string, baselineSlot: Slot, baselineRunAt: Date): VisibilityExperiment {
    return new VisibilityExperiment({
      id: crypto.randomUUID(),
      projectId,
      query,
      baselineSlot,
      baselineRunAt,
      actionAt: new Date(),
      status: "OPEN",
      outcomeSlot: null,
      outcomeRunAt: null,
    });
  }

  static reconstitute(props: VisibilityExperimentProps): VisibilityExperiment {
    return new VisibilityExperiment(props);
  }

  // Idempotent: resolving an already-resolved experiment is a no-op, not an
  // error — a later probe shouldn't overwrite the first post-action reading.
  resolve(outcomeSlot: Slot, outcomeRunAt: Date): void {
    if (this.props.status === "RESOLVED") return;
    this.props.status = "RESOLVED";
    this.props.outcomeSlot = outcomeSlot;
    this.props.outcomeRunAt = outcomeRunAt;
  }

  get outcome(): ExperimentOutcome | null {
    if (this.props.outcomeSlot === null) return null;
    return classifyOutcome(this.props.baselineSlot, this.props.outcomeSlot);
  }

  get id(): string {
    return this.props.id;
  }
  get projectId(): string {
    return this.props.projectId;
  }
  get query(): string {
    return this.props.query;
  }
  get baselineSlot(): Slot {
    return this.props.baselineSlot;
  }
  get baselineRunAt(): Date {
    return this.props.baselineRunAt;
  }
  get actionAt(): Date {
    return this.props.actionAt;
  }
  get status(): ExperimentStatus {
    return this.props.status;
  }
  get outcomeSlot(): Slot | null {
    return this.props.outcomeSlot;
  }
  get outcomeRunAt(): Date | null {
    return this.props.outcomeRunAt;
  }
}
