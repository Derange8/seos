export interface SitemapFileProps {
  id: string;
  projectId: string;
  content: string;
  pageCount: number;
  generatedAt: Date;
}

// Not an aggregate root — there's no state machine or invariant here, just
// a generated artifact (raw sitemap XML) with a timestamp, regenerated
// wholesale every time and kept as history (see SitemapRepositoryPort).
export class SitemapFile {
  private constructor(private readonly props: SitemapFileProps) {}

  static create(projectId: string, content: string, pageCount: number): SitemapFile {
    return new SitemapFile({
      id: crypto.randomUUID(),
      projectId,
      content,
      pageCount,
      generatedAt: new Date(),
    });
  }

  static reconstitute(props: SitemapFileProps): SitemapFile {
    return new SitemapFile(props);
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

  get pageCount(): number {
    return this.props.pageCount;
  }

  get generatedAt(): Date {
    return this.props.generatedAt;
  }
}
