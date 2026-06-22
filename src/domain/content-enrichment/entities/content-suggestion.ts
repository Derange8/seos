export interface ContentSuggestionProps {
  id: string;
  keywordOpportunityId: string;
  content: string;
  createdAt: Date;
}

// One suggestion per KeywordOpportunity (enforced by a unique constraint
// on keywordOpportunityId, see schema.prisma) — regenerating overwrites
// the previous draft rather than accumulating a history, since only the
// latest suggestion is ever shown. Purely a DRAFT artifact: there is no
// apply/revert here (that's Phase 3 — see project plan), only Copy.
export class ContentSuggestion {
  private constructor(private readonly props: ContentSuggestionProps) {}

  static create(keywordOpportunityId: string, content: string): ContentSuggestion {
    return new ContentSuggestion({
      id: crypto.randomUUID(),
      keywordOpportunityId,
      content,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: ContentSuggestionProps): ContentSuggestion {
    return new ContentSuggestion(props);
  }

  get id(): string {
    return this.props.id;
  }

  get keywordOpportunityId(): string {
    return this.props.keywordOpportunityId;
  }

  get content(): string {
    return this.props.content;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
