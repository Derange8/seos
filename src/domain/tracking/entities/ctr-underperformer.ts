export interface CtrUnderperformerProps {
  id: string;
  projectId: string;
  pageUrl: string;
  query: string;
  position: number;
  ctr: number;
  // The site's own average CTR for queries at this same rounded position
  // — not an industry benchmark (those vary wildly by vertical and go
  // stale), so "underperforming" means "worse than this site's own other
  // queries at a comparable rank," a number the data can actually support.
  expectedCtr: number;
  clicks: number;
  impressions: number;
  detectedAt: Date;
}

// Generated artifact, not an aggregate root — one row per (project, page,
// query), wholesale replaced on every re-fetch (see
// CtrUnderperformerRepositoryPort.replaceForProject), same reasoning as
// KeywordCannibalizationIssue: a query that's no longer underperforming
// needs to disappear, not linger as a stale issue.
export class CtrUnderperformer {
  private constructor(private readonly props: CtrUnderperformerProps) {}

  static create(
    projectId: string,
    pageUrl: string,
    query: string,
    position: number,
    ctr: number,
    expectedCtr: number,
    clicks: number,
    impressions: number
  ): CtrUnderperformer {
    return new CtrUnderperformer({
      id: crypto.randomUUID(),
      projectId,
      pageUrl,
      query,
      position,
      ctr,
      expectedCtr,
      clicks,
      impressions,
      detectedAt: new Date(),
    });
  }

  static reconstitute(props: CtrUnderperformerProps): CtrUnderperformer {
    return new CtrUnderperformer(props);
  }

  get id(): string {
    return this.props.id;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get pageUrl(): string {
    return this.props.pageUrl;
  }

  get query(): string {
    return this.props.query;
  }

  get position(): number {
    return this.props.position;
  }

  get ctr(): number {
    return this.props.ctr;
  }

  get expectedCtr(): number {
    return this.props.expectedCtr;
  }

  get clicks(): number {
    return this.props.clicks;
  }

  get impressions(): number {
    return this.props.impressions;
  }

  get detectedAt(): Date {
    return this.props.detectedAt;
  }
}
