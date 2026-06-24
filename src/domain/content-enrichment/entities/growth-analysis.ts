export type GrowthOpportunityPageType = "PRODUCT" | "LANDING" | "CATEGORY" | "COMPARISON" | "BLOG_ARTICLE" | "FAQ";
export type GrowthOpportunityPriority = "HIGH" | "MEDIUM" | "LOW";

export interface GrowthOpportunity {
  title: string;
  searchIntent: string;
  whyUsersSearch: string;
  whyRevenue: string;
  suggestedSlug: string;
  pageType: GrowthOpportunityPageType;
  priority: GrowthOpportunityPriority;
}

export interface ConversionOpportunity {
  pageUrl: string;
  recommendation: string;
}

// Shared between the LLM providers (parsing model output) and the Prisma
// repository (reading back an untyped JSON column — SQLite doesn't
// validate JSON column shape any more than the LLM's own output does) so
// both sides of this boundary apply the exact same "is this really a
// GrowthOpportunity" check rather than two definitions drifting apart.
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isGrowthOpportunity(value: unknown): value is GrowthOpportunity {
  if (!value || typeof value !== "object") return false;
  const { title, searchIntent, whyUsersSearch, whyRevenue, suggestedSlug, pageType, priority } =
    value as Record<string, unknown>;
  return (
    typeof title === "string" &&
    typeof searchIntent === "string" &&
    typeof whyUsersSearch === "string" &&
    typeof whyRevenue === "string" &&
    typeof suggestedSlug === "string" &&
    typeof pageType === "string" &&
    typeof priority === "string"
  );
}

export function isConversionOpportunity(value: unknown): value is ConversionOpportunity {
  if (!value || typeof value !== "object") return false;
  const { pageUrl, recommendation } = value as Record<string, unknown>;
  return typeof pageUrl === "string" && typeof recommendation === "string";
}

export interface GrowthAnalysisProps {
  id: string;
  projectId: string;
  businessUnderstanding: string;
  contentGapsSummary: string;
  opportunities: readonly GrowthOpportunity[];
  conversionOpportunities: readonly ConversionOpportunity[];
  missingCompetitorPages: readonly string[];
  topPages: readonly string[];
  executiveSummary: string;
  generatedAt: Date;
}

// A site-wide BUSINESS-growth report — deliberately not a technical SEO
// audit (that's AuditRun's job). One row per project, replaced wholesale on
// regeneration (see GenerateGrowthAnalysisUseCase) — there's no history,
// since only the latest reflects the current crawl and the current LLM's
// reasoning about it. Like ContentIdea, this is never backed by a real
// search-volume/competition data source, so every consumer (UI included)
// must keep presenting this as reasoned ideas, not verified opportunities.
export class GrowthAnalysis {
  private constructor(private readonly props: GrowthAnalysisProps) {}

  static create(
    projectId: string,
    businessUnderstanding: string,
    contentGapsSummary: string,
    opportunities: readonly GrowthOpportunity[],
    conversionOpportunities: readonly ConversionOpportunity[],
    missingCompetitorPages: readonly string[],
    topPages: readonly string[],
    executiveSummary: string
  ): GrowthAnalysis {
    return new GrowthAnalysis({
      id: crypto.randomUUID(),
      projectId,
      businessUnderstanding,
      contentGapsSummary,
      opportunities,
      conversionOpportunities,
      missingCompetitorPages,
      topPages,
      executiveSummary,
      generatedAt: new Date(),
    });
  }

  static reconstitute(props: GrowthAnalysisProps): GrowthAnalysis {
    return new GrowthAnalysis(props);
  }

  get id(): string {
    return this.props.id;
  }

  get projectId(): string {
    return this.props.projectId;
  }

  get businessUnderstanding(): string {
    return this.props.businessUnderstanding;
  }

  get contentGapsSummary(): string {
    return this.props.contentGapsSummary;
  }

  get opportunities(): readonly GrowthOpportunity[] {
    return this.props.opportunities;
  }

  get conversionOpportunities(): readonly ConversionOpportunity[] {
    return this.props.conversionOpportunities;
  }

  get missingCompetitorPages(): readonly string[] {
    return this.props.missingCompetitorPages;
  }

  get topPages(): readonly string[] {
    return this.props.topPages;
  }

  get executiveSummary(): string {
    return this.props.executiveSummary;
  }

  get generatedAt(): Date {
    return this.props.generatedAt;
  }
}
