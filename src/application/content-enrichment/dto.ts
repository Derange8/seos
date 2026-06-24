import type { ContentSuggestion } from "@/domain/content-enrichment/entities/content-suggestion";
import type { ContentIdea } from "@/domain/content-enrichment/entities/content-idea";
import type {
  ConversionOpportunity,
  GrowthAnalysis,
  GrowthOpportunity,
} from "@/domain/content-enrichment/entities/growth-analysis";

export interface ContentSuggestionDto {
  keywordOpportunityId: string;
  content: string;
  createdAt: string;
}

export function toContentSuggestionDto(suggestion: ContentSuggestion): ContentSuggestionDto {
  return {
    keywordOpportunityId: suggestion.keywordOpportunityId,
    content: suggestion.content,
    createdAt: suggestion.createdAt.toISOString(),
  };
}

export interface ContentIdeaDto {
  id: string;
  sourcePageUrl: string;
  topic: string;
  suggestedTitle: string;
  suggestedSlug: string;
  rationale: string;
  createdAt: string;
}

export function toContentIdeaDto(idea: ContentIdea): ContentIdeaDto {
  return {
    id: idea.id,
    sourcePageUrl: idea.sourcePageUrl,
    topic: idea.topic,
    suggestedTitle: idea.suggestedTitle,
    suggestedSlug: idea.suggestedSlug,
    rationale: idea.rationale,
    createdAt: idea.createdAt.toISOString(),
  };
}

export interface GrowthAnalysisDto {
  id: string;
  businessUnderstanding: string;
  contentGapsSummary: string;
  opportunities: readonly GrowthOpportunity[];
  conversionOpportunities: readonly ConversionOpportunity[];
  missingCompetitorPages: readonly string[];
  topPages: readonly string[];
  executiveSummary: string;
  generatedAt: string;
}

export function toGrowthAnalysisDto(analysis: GrowthAnalysis): GrowthAnalysisDto {
  return {
    id: analysis.id,
    businessUnderstanding: analysis.businessUnderstanding,
    contentGapsSummary: analysis.contentGapsSummary,
    opportunities: analysis.opportunities,
    conversionOpportunities: analysis.conversionOpportunities,
    missingCompetitorPages: analysis.missingCompetitorPages,
    topPages: analysis.topPages,
    executiveSummary: analysis.executiveSummary,
    generatedAt: analysis.generatedAt.toISOString(),
  };
}
