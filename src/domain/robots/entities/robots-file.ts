export interface RobotsFileProps {
  id: string;
  projectId: string;
  content: string;
  generatedAt: Date;
}

// Same shape as SitemapFile and for the same reason — a generated artifact,
// not an aggregate with invariants. Unlike SitemapFile/AuditRun there's no
// "per crawl" axis here (content is a pure function of the project's
// domain, which never changes post-creation), so callers treat this as a
// cache rather than a history: see GetOrGenerateRobotsFileUseCase.
export class RobotsFile {
  private constructor(private readonly props: RobotsFileProps) {}

  static create(projectId: string, content: string): RobotsFile {
    return new RobotsFile({
      id: crypto.randomUUID(),
      projectId,
      content,
      generatedAt: new Date(),
    });
  }

  static reconstitute(props: RobotsFileProps): RobotsFile {
    return new RobotsFile(props);
  }

  get id(): string {
    return this.props.id;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get content(): string {
    return this.props.content;
  }

  get generatedAt(): Date {
    return this.props.generatedAt;
  }
}
