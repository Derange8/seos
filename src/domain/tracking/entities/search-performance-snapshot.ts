export interface SearchPerformanceSnapshotProps {
  id: string;
  projectId: string;
  date: Date;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// Generated artifact, not an aggregate root — one row per project per
// day, overwritten (not appended) on re-fetch, since Search Console
// itself revises the last few days' numbers as data settles.
export class SearchPerformanceSnapshot {
  private constructor(private readonly props: SearchPerformanceSnapshotProps) {}

  static create(
    projectId: string,
    date: Date,
    clicks: number,
    impressions: number,
    ctr: number,
    position: number
  ): SearchPerformanceSnapshot {
    return new SearchPerformanceSnapshot({ id: crypto.randomUUID(), projectId, date, clicks, impressions, ctr, position });
  }

  static reconstitute(props: SearchPerformanceSnapshotProps): SearchPerformanceSnapshot {
    return new SearchPerformanceSnapshot(props);
  }

  get id(): string {
    return this.props.id;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get date(): Date {
    return this.props.date;
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
