export interface PagePerformanceProps {
  id: string;
  projectId: string;
  pageUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// Generated artifact, not an aggregate root — one row per (project, page),
// overwritten (not appended) on re-fetch, same reasoning as
// SearchPerformanceSnapshot/KeywordOpportunity. Unlike KeywordOpportunity
// (a curated "striking distance" shortlist), this holds every page's real
// totals across ALL queries, unfiltered — the honest dataset traffic-impact
// scoring needs.
export class PagePerformance {
  private constructor(private readonly props: PagePerformanceProps) {}

  static create(
    projectId: string,
    pageUrl: string,
    clicks: number,
    impressions: number,
    ctr: number,
    position: number
  ): PagePerformance {
    return new PagePerformance({
      id: crypto.randomUUID(),
      projectId,
      pageUrl,
      clicks,
      impressions,
      ctr,
      position,
    });
  }

  static reconstitute(props: PagePerformanceProps): PagePerformance {
    return new PagePerformance(props);
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
