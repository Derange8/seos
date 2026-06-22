export type SchemaMarkupType = "Organization" | "BreadcrumbList" | "FAQPage";
export type SchemaMarkupSource = "rule_based" | "ai_generated" | "manual";
export type SchemaMarkupStatus = "DRAFT" | "APPROVED";

export interface SchemaMarkupProps {
  id: string;
  pageId: string;
  type: SchemaMarkupType;
  jsonLd: Record<string, unknown>;
  source: SchemaMarkupSource;
  status: SchemaMarkupStatus;
  createdAt: Date;
}

// Generated artifact, not an aggregate root — same reasoning as
// SitemapFile/RobotsFile. createRuleBased() is the only factory for now
// because this whole feature is rule-based v1 (architecture decision #3:
// schema generation is template/rule-driven). FAQPage is rule-based too —
// detected from existing heading+answer structure already on the page
// (see Faq on the Page entity), not LLM-generated; Article would need real
// content understanding (is this actually an article? what's it about?)
// that structure detection alone can't give, so it's deferred rather than
// guessed at. Deterministic output needs no human review, so everything
// here is APPROVED immediately. A future createAiGenerated() would default
// to DRAFT pending review instead.
export class SchemaMarkup {
  private constructor(private readonly props: SchemaMarkupProps) {}

  static createRuleBased(
    pageId: string,
    type: SchemaMarkupType,
    jsonLd: Record<string, unknown>
  ): SchemaMarkup {
    return new SchemaMarkup({
      id: crypto.randomUUID(),
      pageId,
      type,
      jsonLd,
      source: "rule_based",
      status: "APPROVED",
      createdAt: new Date(),
    });
  }

  static reconstitute(props: SchemaMarkupProps): SchemaMarkup {
    return new SchemaMarkup(props);
  }

  get id(): string {
    return this.props.id;
  }

  get pageId(): string {
    return this.props.pageId;
  }

  get type(): SchemaMarkupType {
    return this.props.type;
  }

  get jsonLd(): Record<string, unknown> {
    return this.props.jsonLd;
  }

  get source(): SchemaMarkupSource {
    return this.props.source;
  }

  get status(): SchemaMarkupStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
