import type { Slot } from "@/domain/ai-visibility/slot";
import { SLOT_RANK } from "@/domain/ai-visibility/slot";

export type ExperimentStatus = "OPEN" | "RESOLVED";

// Whether the query's position moved forward, back, or not at all between the
// baseline and the post-action re-measure. Honest label: this is observed
// correlation over time, not proven causation — the app can't verify the user
// actually published the drafted content.
export type ExperimentOutcome = "IMPROVED" | "UNCHANGED" | "REGRESSED";

// The citation-axis reading between baseline and outcome, kept separate from
// the mention slot because a query can gain a citation (its site enters the
// answer's sources) before — or without ever — moving to MENTIONED.
//  - "GAINED":    was not cited at baseline, is cited now
//  - "LOST":      was cited at baseline, isn't now
//  - "UNCHANGED": no change either way
//  - "NA":        can't compare (either reading wasn't web_grounded, so there
//                 were no citations to observe) — never counted as a win/loss
export type CitationMovement = "GAINED" | "LOST" | "UNCHANGED" | "NA";

export function classifyCitationMovement(
  baselineGrounded: boolean,
  baselineCited: boolean,
  outcomeGrounded: boolean,
  outcomeCited: boolean
): CitationMovement {
  // Citation only exists on the web-grounded surface. If either end wasn't
  // web-grounded, comparing citation is meaningless — refuse to, so a
  // parametric baseline (citedSamples always 0) followed by a web_grounded
  // outcome never fabricates a "GAINED".
  if (!baselineGrounded || !outcomeGrounded) return "NA";
  if (baselineCited === outcomeCited) return "UNCHANGED";
  return outcomeCited ? "GAINED" : "LOST";
}

// The overall outcome combines the two axes. The mention slot dominates when
// it moves (it's the stronger signal); when the slot is flat, a citation
// gain/loss is what breaks the tie — this is the whole point of Faz 2,
// crediting a citation win the mention-only classifier used to call UNCHANGED.
export function classifyOutcome(
  baseline: Slot,
  outcome: Slot,
  citation: CitationMovement = "NA"
): ExperimentOutcome {
  const slotDiff = SLOT_RANK[outcome] - SLOT_RANK[baseline];
  if (slotDiff > 0) return "IMPROVED";
  if (slotDiff < 0) return "REGRESSED";
  // Slot unchanged — let the citation axis break the tie.
  if (citation === "GAINED") return "IMPROVED";
  if (citation === "LOST") return "REGRESSED";
  return "UNCHANGED";
}

export interface VisibilityExperimentProps {
  id: string;
  projectId: string;
  query: string;
  baselineSlot: Slot;
  // When the baseline slot was observed (the probe run it came from).
  baselineRunAt: Date;
  // Citation axis at baseline: whether the baseline run was web-grounded (only
  // then can citation be observed at all) and whether the target domain was
  // cited for this query. baselineGrounded=false means citation can't be
  // compared later (see classifyCitationMovement).
  baselineGrounded: boolean;
  baselineCited: boolean;
  // When the user acted (drafted citation content for this query).
  actionAt: Date;
  status: ExperimentStatus;
  outcomeSlot: Slot | null;
  outcomeRunAt: Date | null;
  // Citation axis at outcome — null until resolved, mirroring outcomeSlot.
  outcomeGrounded: boolean | null;
  outcomeCited: boolean | null;
}

// One tracked "did acting on this query move its AI visibility?" record — the
// local learning substrate a future collective model would aggregate. Opened
// when content is drafted for a query, resolved by the next probe run that
// re-measures that query.
export class VisibilityExperiment {
  private constructor(private readonly props: VisibilityExperimentProps) {}

  static start(
    projectId: string,
    query: string,
    baselineSlot: Slot,
    baselineRunAt: Date,
    baselineGrounded: boolean,
    baselineCited: boolean
  ): VisibilityExperiment {
    return new VisibilityExperiment({
      id: crypto.randomUUID(),
      projectId,
      query,
      baselineSlot,
      baselineRunAt,
      baselineGrounded,
      baselineCited,
      actionAt: new Date(),
      status: "OPEN",
      outcomeSlot: null,
      outcomeRunAt: null,
      outcomeGrounded: null,
      outcomeCited: null,
    });
  }

  static reconstitute(props: VisibilityExperimentProps): VisibilityExperiment {
    return new VisibilityExperiment(props);
  }

  // Idempotent: resolving an already-resolved experiment is a no-op, not an
  // error — a later probe shouldn't overwrite the first post-action reading.
  resolve(outcomeSlot: Slot, outcomeRunAt: Date, outcomeGrounded: boolean, outcomeCited: boolean): void {
    if (this.props.status === "RESOLVED") return;
    this.props.status = "RESOLVED";
    this.props.outcomeSlot = outcomeSlot;
    this.props.outcomeRunAt = outcomeRunAt;
    this.props.outcomeGrounded = outcomeGrounded;
    this.props.outcomeCited = outcomeCited;
  }

  get outcome(): ExperimentOutcome | null {
    if (this.props.outcomeSlot === null) return null;
    // citationMovement is non-null here (outcomeSlot set ⟹ resolved), but
    // coalesce to NA to satisfy the type and stay safe.
    return classifyOutcome(this.props.baselineSlot, this.props.outcomeSlot, this.citationMovement ?? "NA");
  }

  // The citation-axis reading, null until resolved. NA (not comparable) once
  // resolved if either end wasn't web-grounded.
  get citationMovement(): CitationMovement | null {
    if (this.props.outcomeGrounded === null || this.props.outcomeCited === null) return null;
    return classifyCitationMovement(
      this.props.baselineGrounded,
      this.props.baselineCited,
      this.props.outcomeGrounded,
      this.props.outcomeCited
    );
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
  get baselineGrounded(): boolean {
    return this.props.baselineGrounded;
  }
  get baselineCited(): boolean {
    return this.props.baselineCited;
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
  get outcomeGrounded(): boolean | null {
    return this.props.outcomeGrounded;
  }
  get outcomeCited(): boolean | null {
    return this.props.outcomeCited;
  }
}
