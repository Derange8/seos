export interface LlmsTxtFileProps {
  id: string;
  projectId: string;
  content: string;
  pageCount: number;
  generatedAt: Date;
}

// Same shape and lifecycle as SitemapFile — a generated artifact, kept as
// append-only history (one row per crawl), no state machine or invariant
// beyond "these fields exist."
export class LlmsTxtFile {
  private constructor(private readonly props: LlmsTxtFileProps) {}

  static create(projectId: string, content: string, pageCount: number): LlmsTxtFile {
    return new LlmsTxtFile({
      id: crypto.randomUUID(),
      projectId,
      content,
      pageCount,
      generatedAt: new Date(),
    });
  }

  static reconstitute(props: LlmsTxtFileProps): LlmsTxtFile {
    return new LlmsTxtFile(props);
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
