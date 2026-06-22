import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export type FixType = "TITLE" | "META_DESCRIPTION" | "H1" | "CANONICAL_URL";
export type FixSource = "rule_based" | "ai_generated";
export type FixStatus = "DRAFT" | "APPLIED" | "FAILED";

export class InvalidFixCandidateStateError extends DomainError {
  readonly code = "INVALID_FIX_CANDIDATE_STATE";
}

export interface FixCandidateProps {
  id: string;
  auditIssueId: string;
  pageId: string;
  type: FixType;
  content: string;
  source: FixSource;
  status: FixStatus;
  // The live value this fix candidate overwrote, captured at apply time —
  // null until applied. Exists purely so revert() has something to push
  // back; the SEO Agent Trust Model treats "never act without a way back"
  // as non-negotiable, not optional polish.
  previousValue: string | null;
  createdAt: Date;
}

// SEO Agent autonomy Level 2 ("generate fixes") by default — a FixCandidate
// is a ready-to-use piece of content, never auto-applied. Level 3 ("apply
// after approval") is reached when a caller explicitly calls applyTo()
// (see ApplyFixCandidateUseCase) — the click itself *is* the approval,
// there's no separate "approved but not yet applied" state to model.
export class FixCandidate {
  private constructor(private readonly props: FixCandidateProps) {}

  static createRuleBased(auditIssueId: string, pageId: string, type: FixType, content: string): FixCandidate {
    return new FixCandidate({
      id: crypto.randomUUID(),
      auditIssueId,
      pageId,
      type,
      content,
      source: "rule_based",
      status: "DRAFT",
      previousValue: null,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: FixCandidateProps): FixCandidate {
    return new FixCandidate(props);
  }

  get id(): string {
    return this.props.id;
  }

  get auditIssueId(): string {
    return this.props.auditIssueId;
  }

  get pageId(): string {
    return this.props.pageId;
  }

  get type(): FixType {
    return this.props.type;
  }

  get content(): string {
    return this.props.content;
  }

  get source(): FixSource {
    return this.props.source;
  }

  get status(): FixStatus {
    return this.props.status;
  }

  get previousValue(): string | null {
    return this.props.previousValue;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  // DRAFT (never tried) and FAILED (tried, didn't stick — retryable) can
  // both move to APPLIED; an already-APPLIED fix must be reverted first
  // rather than re-applied over itself.
  markApplied(previousValue: string): Result<void, InvalidFixCandidateStateError> {
    if (this.props.status === "APPLIED") {
      return err(new InvalidFixCandidateStateError(`FixCandidate "${this.props.id}" is already applied`));
    }
    this.props.status = "APPLIED";
    this.props.previousValue = previousValue;
    return ok(undefined);
  }

  markFailed(): Result<void, InvalidFixCandidateStateError> {
    if (this.props.status === "APPLIED") {
      return err(
        new InvalidFixCandidateStateError(`FixCandidate "${this.props.id}" is already applied, cannot mark failed`)
      );
    }
    this.props.status = "FAILED";
    return ok(undefined);
  }

  // Back to DRAFT, not a separate REVERTED state — once reverted, it's
  // once again just a proposal that can be re-applied later.
  revert(): Result<void, InvalidFixCandidateStateError> {
    if (this.props.status !== "APPLIED") {
      return err(new InvalidFixCandidateStateError(`FixCandidate "${this.props.id}" is not currently applied`));
    }
    this.props.status = "DRAFT";
    this.props.previousValue = null;
    return ok(undefined);
  }
}
