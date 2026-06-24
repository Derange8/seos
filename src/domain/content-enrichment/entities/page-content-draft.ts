export interface DraftBodySection {
  heading: string;
  content: string;
}

export interface DraftFaq {
  question: string;
  answer: string;
}

export interface PageContentDraftProps {
  id: string;
  projectId: string;
  pageUrl: string;
  suggestedTitle: string;
  suggestedMetaDescription: string;
  bodySections: readonly DraftBodySection[];
  faqs: readonly DraftFaq[];
  generatedAt: Date;
}

// Ready-to-publish draft content for one crawled page — the action step that
// turns a growth gap into a usable asset. Distinct from ContentSuggestion
// (which drafts text for a page targeting a real GSC query) and ContentIdea
// (which only names a new-page topic): this writes the actual on-page body +
// FAQ, grounded purely in the page's own crawled content, so it needs no
// search data and works on any site. One per (project, page), overwritten on
// regenerate.
export class PageContentDraft {
  private constructor(private readonly props: PageContentDraftProps) {}

  static create(
    projectId: string,
    pageUrl: string,
    suggestedTitle: string,
    suggestedMetaDescription: string,
    bodySections: readonly DraftBodySection[],
    faqs: readonly DraftFaq[]
  ): PageContentDraft {
    return new PageContentDraft({
      id: crypto.randomUUID(),
      projectId,
      pageUrl,
      suggestedTitle,
      suggestedMetaDescription,
      bodySections,
      faqs,
      generatedAt: new Date(),
    });
  }

  static reconstitute(props: PageContentDraftProps): PageContentDraft {
    return new PageContentDraft(props);
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

  get suggestedTitle(): string {
    return this.props.suggestedTitle;
  }

  get suggestedMetaDescription(): string {
    return this.props.suggestedMetaDescription;
  }

  get bodySections(): readonly DraftBodySection[] {
    return this.props.bodySections;
  }

  get faqs(): readonly DraftFaq[] {
    return this.props.faqs;
  }

  get generatedAt(): Date {
    return this.props.generatedAt;
  }
}

export function isDraftBodySection(value: unknown): value is DraftBodySection {
  if (!value || typeof value !== "object") return false;
  const { heading, content } = value as Record<string, unknown>;
  return typeof heading === "string" && typeof content === "string";
}

export function isDraftFaq(value: unknown): value is DraftFaq {
  if (!value || typeof value !== "object") return false;
  const { question, answer } = value as Record<string, unknown>;
  return typeof question === "string" && typeof answer === "string";
}
