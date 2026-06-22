export interface KeywordOpportunityProps {
  id: string;
  projectId: string;
  pageUrl: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// Generated artifact, not an aggregate root — one row per (project, page,
// query), overwritten (not appended) on re-fetch, same reasoning as
// SearchPerformanceSnapshot. Only rows already filtered to the "striking
// distance" position/impressions band (see FetchKeywordOpportunitiesUseCase)
// are ever persisted here — this is a curated shortlist, not raw GSC output.
export class KeywordOpportunity {
  private constructor(private readonly props: KeywordOpportunityProps) {}

  static create(
    projectId: string,
    pageUrl: string,
    query: string,
    clicks: number,
    impressions: number,
    ctr: number,
    position: number
  ): KeywordOpportunity {
    return new KeywordOpportunity({
      id: crypto.randomUUID(),
      projectId,
      pageUrl,
      query,
      clicks,
      impressions,
      ctr,
      position,
    });
  }

  static reconstitute(props: KeywordOpportunityProps): KeywordOpportunity {
    return new KeywordOpportunity(props);
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

  get clicks(): number {
    return this.props.clicks;
  }

  get impressions(): number {
    return this.props.impressions;
  }

  get ctr(): number {
    return this.props.ctr;
  }

  get position(): number {
    return this.props.position;
  }
}
