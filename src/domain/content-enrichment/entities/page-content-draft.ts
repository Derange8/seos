import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export interface DraftBodySection {
  heading: string;
  content: string;
}

export interface DraftFaq {
  question: string;
  answer: string;
}

export type PageContentDraftStatus = "DRAFT" | "PUBLISHED" | "FAILED";

export class InvalidPageContentDraftStateError extends DomainError {
  readonly code = "INVALID_PAGE_CONTENT_DRAFT_STATE";
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
  status: PageContentDraftStatus;
  // The live WordPress title/excerpt/content this draft overwrote, captured
  // at publish time — null until published. Same "never act without a way
  // back" reasoning as FixCandidate.previousValue.
  previousTitle: string | null;
  previousMetaDescription: string | null;
  previousContent: string | null;
}

// Ready-to-publish draft content for one crawled page — the action step that
// turns a growth gap into a usable asset. Distinct from ContentSuggestion
// (which drafts text for a page targeting a real GSC query) and ContentIdea
// (which only names a new-page topic): this writes the actual on-page body +
// FAQ, grounded purely in the page's own crawled content, so it needs no
// search data and works on any site. One per (project, page), overwritten on
// regenerate — regenerating always resets to DRAFT (see
// GeneratePageContentDraftUseCase), since the previously-published content
// no longer matches what a re-publish would push.
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
      status: "DRAFT",
      previousTitle: null,
      previousMetaDescription: null,
      previousContent: null,
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

  get status(): PageContentDraftStatus {
    return this.props.status;
  }

  get previousTitle(): string | null {
    return this.props.previousTitle;
  }

  get previousMetaDescription(): string | null {
    return this.props.previousMetaDescription;
  }

  get previousContent(): string | null {
    return this.props.previousContent;
  }

  // The "Publish" click *is* the approval — same reasoning as
  // FixCandidate.markApplied(), no separate "approved but not yet
  // published" state to model.
  markPublished(
    previousTitle: string,
    previousMetaDescription: string,
    previousContent: string
  ): Result<void, InvalidPageContentDraftStateError> {
    if (this.props.status === "PUBLISHED") {
      return err(new InvalidPageContentDraftStateError(`PageContentDraft "${this.props.id}" is already published`));
    }
    this.props.status = "PUBLISHED";
    this.props.previousTitle = previousTitle;
    this.props.previousMetaDescription = previousMetaDescription;
    this.props.previousContent = previousContent;
    return ok(undefined);
  }

  // Back to DRAFT, not a separate REVERTED state — same shape as
  // FixCandidate.revert().
  revert(): Result<void, InvalidPageContentDraftStateError> {
    if (this.props.status !== "PUBLISHED") {
      return err(new InvalidPageContentDraftStateError(`PageContentDraft "${this.props.id}" is not currently published`));
    }
    this.props.status = "DRAFT";
    this.props.previousTitle = null;
    this.props.previousMetaDescription = null;
    this.props.previousContent = null;
    return ok(undefined);
  }

  // Distinct from staying DRAFT — a FAILED publish attempt is a real,
  // visible record that something was tried and didn't stick (same
  // reasoning as FixCandidate.markFailed()'s own doc comment), not silently
  // indistinguishable from "never attempted."
  markFailed(): Result<void, InvalidPageContentDraftStateError> {
    if (this.props.status === "PUBLISHED") {
      return err(
        new InvalidPageContentDraftStateError(`PageContentDraft "${this.props.id}" is already published, cannot mark failed`)
      );
    }
    this.props.status = "FAILED";
    return ok(undefined);
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
