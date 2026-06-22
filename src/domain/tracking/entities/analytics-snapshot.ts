export interface AnalyticsSnapshotProps {
  id: string;
  projectId: string;
  date: Date;
  organicSessions: number;
  conversions: number;
}

// Same shape/lifecycle as SearchPerformanceSnapshot — one row per project
// per day, overwritten on re-fetch. organicSessions/conversions only (not
// total site traffic): for an SEO tool, "is content driving organic
// traffic" is the relevant story, not paid/direct/referral sessions.
export class AnalyticsSnapshot {
  private constructor(private readonly props: AnalyticsSnapshotProps) {}

  static create(projectId: string, date: Date, organicSessions: number, conversions: number): AnalyticsSnapshot {
    return new AnalyticsSnapshot({ id: crypto.randomUUID(), projectId, date, organicSessions, conversions });
  }

  static reconstitute(props: AnalyticsSnapshotProps): AnalyticsSnapshot {
    return new AnalyticsSnapshot(props);
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

  get organicSessions(): number {
    return this.props.organicSessions;
  }

  get conversions(): number {
    return this.props.conversions;
  }
}
