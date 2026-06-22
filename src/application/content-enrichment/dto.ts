import type { ContentSuggestion } from "@/domain/content-enrichment/entities/content-suggestion";

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
