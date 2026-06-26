// One competing page's own metrics for the shared query — not an entity,
// just a value recorded alongside the others competing for the same query.
export interface CannibalizingPage {
  pageUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface KeywordCannibalizationIssueProps {
  id: string;
  projectId: string;
  query: string;
  // 2+ distinct pages, sorted most-impressions-first — that ordering is
  // itself part of the diagnosis (which page Google currently prefers).
  pages: readonly CannibalizingPage[];
  detectedAt: Date;
}

// Generated artifact, not an aggregate root — one row per (project, query),
// replaced wholesale on every re-fetch (see
// KeywordCannibalizationRepositoryPort.replaceForProject), not upserted
// individually like KeywordOpportunity: a query that's no longer
// cannibalized needs to actually disappear, not linger as a stale issue.
export class KeywordCannibalizationIssue {
  private constructor(private readonly props: KeywordCannibalizationIssueProps) {}

  static create(projectId: string, query: string, pages: readonly CannibalizingPage[]): KeywordCannibalizationIssue {
    return new KeywordCannibalizationIssue({
      id: crypto.randomUUID(),
      projectId,
      query,
      pages,
      detectedAt: new Date(),
    });
  }

  static reconstitute(props: KeywordCannibalizationIssueProps): KeywordCannibalizationIssue {
    return new KeywordCannibalizationIssue(props);
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

  get pages(): readonly CannibalizingPage[] {
    return this.props.pages;
  }

  get detectedAt(): Date {
    return this.props.detectedAt;
  }
}
