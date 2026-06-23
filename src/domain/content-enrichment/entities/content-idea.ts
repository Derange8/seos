export interface ContentIdeaProps {
  id: string;
  projectId: string;
  sourcePageUrl: string;
  topic: string;
  suggestedTitle: string;
  suggestedSlug: string;
  rationale: string;
  createdAt: Date;
}

// A "worth writing" idea for a brand-new page, derived from an existing
// crawled page's topic — not the same thing as ContentSuggestion (which
// drafts text for an EXISTING page targeting a real, measured GSC query).
// There is no real search-volume/ranking data behind this, by construction
// — see GenerateContentIdeasUseCase — so nothing here should ever be
// presented as a verified opportunity, only as an idea worth considering.
export class ContentIdea {
  private constructor(private readonly props: ContentIdeaProps) {}

  static create(
    projectId: string,
    sourcePageUrl: string,
    topic: string,
    suggestedTitle: string,
    suggestedSlug: string,
    rationale: string
  ): ContentIdea {
    return new ContentIdea({
      id: crypto.randomUUID(),
      projectId,
      sourcePageUrl,
      topic,
      suggestedTitle,
      suggestedSlug,
      rationale,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: ContentIdeaProps): ContentIdea {
    return new ContentIdea(props);
  }

  get id(): string {
    return this.props.id;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get sourcePageUrl(): string {
    return this.props.sourcePageUrl;
  }

  get topic(): string {
    return this.props.topic;
  }

  get suggestedTitle(): string {
    return this.props.suggestedTitle;
  }

  get suggestedSlug(): string {
    return this.props.suggestedSlug;
  }

  get rationale(): string {
    return this.props.rationale;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
