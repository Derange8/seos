export type AuditCategory = "technical" | "content" | "performance" | "structured_data";
export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface AuditFinding {
  ruleId: string;
  category: AuditCategory;
  severity: AuditSeverity;
  message: string;
}

export interface AuditIssueProps {
  id: string;
  auditRunId: string;
  pageId: string;
  ruleId: string;
  category: AuditCategory;
  severity: AuditSeverity;
  message: string;
  recommendation: string | null;
  createdAt: Date;
}

export class AuditIssue {
  private constructor(private readonly props: AuditIssueProps) {}

  static create(auditRunId: string, pageId: string, finding: AuditFinding): AuditIssue {
    return new AuditIssue({
      id: crypto.randomUUID(),
      auditRunId,
      pageId,
      ruleId: finding.ruleId,
      category: finding.category,
      severity: finding.severity,
      message: finding.message,
      // Filled in later by an async LLM recommendation job — not this engine's job.
      recommendation: null,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: AuditIssueProps): AuditIssue {
    return new AuditIssue(props);
  }

  get id(): string {
    return this.props.id;
  }

  get auditRunId(): string {
    return this.props.auditRunId;
  }

  get pageId(): string {
    return this.props.pageId;
  }

  get ruleId(): string {
    return this.props.ruleId;
  }

  get category(): AuditCategory {
    return this.props.category;
  }

  get severity(): AuditSeverity {
    return this.props.severity;
  }

  get message(): string {
    return this.props.message;
  }

  get recommendation(): string | null {
    return this.props.recommendation;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  // Filled in later by GenerateAuditRecommendationsUseCase (an async LLM
  // job, separate from the audit run itself — see architecture decision
  // #3). No invariant to guard: re-setting is just regenerating, not a
  // state transition.
  setRecommendation(text: string): void {
    this.props.recommendation = text;
  }
}
