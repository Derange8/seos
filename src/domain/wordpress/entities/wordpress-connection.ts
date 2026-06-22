export interface WordPressConnectionProps {
  id: string;
  projectId: string;
  siteUrl: string;
  username: string;
  // Plaintext in memory — encryption-at-rest is purely a repository/
  // infrastructure concern (see PrismaWordPressConnectionRepository), the
  // same separation already used for every other persisted value in this
  // codebase (e.g. enum mapping, JSON serialization).
  applicationPassword: string;
  createdAt: Date;
}

// One connection per project (1:1, enforced at the schema level) — a
// project represents one verified site, so it maps to at most one
// WordPress install. Not an aggregate root: no invariant to protect
// beyond "these four fields exist," and nothing else hangs off it.
export class WordPressConnection {
  private constructor(private readonly props: WordPressConnectionProps) {}

  static create(projectId: string, siteUrl: string, username: string, applicationPassword: string): WordPressConnection {
    return new WordPressConnection({
      id: crypto.randomUUID(),
      projectId,
      siteUrl,
      username,
      applicationPassword,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: WordPressConnectionProps): WordPressConnection {
    return new WordPressConnection(props);
  }

  get id(): string {
    return this.props.id;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get siteUrl(): string {
    return this.props.siteUrl;
  }

  get username(): string {
    return this.props.username;
  }

  get applicationPassword(): string {
    return this.props.applicationPassword;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
