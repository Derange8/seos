export interface GoogleConnectionProps {
  id: string;
  projectId: string;
  // Plaintext in memory — encryption-at-rest is purely a repository
  // concern (see PrismaGoogleConnectionRepository), same separation every
  // other persisted credential in this codebase already uses. Only the
  // refresh token is ever persisted; access tokens are short-lived and
  // re-derived from it before each API call instead of stored.
  refreshToken: string;
  gscSiteUrl: string | null;
  ga4PropertyId: string | null;
  autoRefreshEnabled: boolean;
  createdAt: Date;
}

// One connection per project (1:1), same reasoning as WordPressConnection.
export class GoogleConnection {
  private constructor(private readonly props: GoogleConnectionProps) {}

  static create(projectId: string, refreshToken: string, gscSiteUrl: string | null): GoogleConnection {
    return new GoogleConnection({
      id: crypto.randomUUID(),
      projectId,
      refreshToken,
      gscSiteUrl,
      ga4PropertyId: null,
      autoRefreshEnabled: true,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: GoogleConnectionProps): GoogleConnection {
    return new GoogleConnection(props);
  }

  withGscSiteUrl(gscSiteUrl: string): GoogleConnection {
    return new GoogleConnection({ ...this.props, gscSiteUrl });
  }

  withGa4PropertyId(ga4PropertyId: string | null): GoogleConnection {
    return new GoogleConnection({ ...this.props, ga4PropertyId });
  }

  withAutoRefreshEnabled(autoRefreshEnabled: boolean): GoogleConnection {
    return new GoogleConnection({ ...this.props, autoRefreshEnabled });
  }

  get id(): string {
    return this.props.id;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get refreshToken(): string {
    return this.props.refreshToken;
  }

  get gscSiteUrl(): string | null {
    return this.props.gscSiteUrl;
  }

  get ga4PropertyId(): string | null {
    return this.props.ga4PropertyId;
  }

  get autoRefreshEnabled(): boolean {
    return this.props.autoRefreshEnabled;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
