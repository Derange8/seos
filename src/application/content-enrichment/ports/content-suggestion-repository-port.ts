import type { ContentSuggestion } from "@/domain/content-enrichment/entities/content-suggestion";

export interface ContentSuggestionRepositoryPort {
  // Upserts by keywordOpportunityId — regenerating replaces the prior draft.
  save(suggestion: ContentSuggestion): Promise<void>;
  findByProjectId(projectId: string): Promise<ContentSuggestion[]>;
}
