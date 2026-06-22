import { AggregateRoot } from "@/shared/aggregate-root";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";
import { AuditRunCompleted } from "@/domain/auditing/events/audit-run-completed";
import type { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { SEVERITY_PENALTY } from "@/domain/auditing/services/severity-penalty";

export class AuditRunStateError extends DomainError {
  readonly code = "INVALID_AUDIT_RUN_STATE";
}

export interface AuditRunProps {
  id: string;
  projectId: string;
  crawlJobId: string;
  issues: AuditIssue[];
  overallScore: number | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export class AuditRun extends AggregateRoot {
  private constructor(private readonly props: AuditRunProps) {
    super();
  }

  static create(projectId: string, crawlJobId: string): AuditRun {
    return new AuditRun({
      id: crypto.randomUUID(),
      projectId,
      crawlJobId,
      issues: [],
      overallScore: null,
      startedAt: new Date(),
      finishedAt: null,
    });
  }

  static reconstitute(props: AuditRunProps): AuditRun {
    return new AuditRun(props);
  }

  get id(): string {
    return this.props.id;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get crawlJobId(): string {
    return this.props.crawlJobId;
  }

  get issues(): readonly AuditIssue[] {
    return this.props.issues;
  }

  get overallScore(): number | null {
    return this.props.overallScore;
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get finishedAt(): Date | null {
    return this.props.finishedAt;
  }

  get isFinished(): boolean {
    return this.props.finishedAt !== null;
  }

  addIssue(issue: AuditIssue): void {
    this.props.issues.push(issue);
  }

  // pageCount comes from the caller (not issues.length) because it's the
  // denominator for normalizing penalty-per-page, independent of how many
  // issues were actually found.
  finish(pageCount: number): Result<void, AuditRunStateError> {
    if (this.isFinished) {
      return err(new AuditRunStateError(`Audit run "${this.id}" has already finished`));
    }

    const totalPenalty = this.props.issues.reduce(
      (sum, issue) => sum + SEVERITY_PENALTY[issue.severity],
      0
    );
    const score = pageCount > 0 ? Math.max(0, 100 - totalPenalty / pageCount) : 100;

    this.props.overallScore = Math.round(score * 100) / 100;
    this.props.finishedAt = new Date();
    this.addDomainEvent(new AuditRunCompleted(this.id, this.projectId));
    return ok(undefined);
  }
}
