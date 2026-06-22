import { ContentSuggestion } from "@/domain/content-enrichment/entities/content-suggestion";
import type { KeywordOpportunityRepositoryPort } from "@/application/tracking/ports/keyword-opportunity-repository-port";
import { NoLlmProviderConfiguredError, type ContentEnrichmentPort } from "@/application/content-enrichment/ports/content-enrichment-port";
import type { ContentSuggestionRepositoryPort } from "@/application/content-enrichment/ports/content-suggestion-repository-port";
import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class KeywordOpportunityNotFoundError extends DomainError {
  readonly code = "KEYWORD_OPPORTUNITY_NOT_FOUND";
}

export class ContentGenerationFailedError extends DomainError {
  readonly code = "CONTENT_GENERATION_FAILED";
}

export interface GenerateContentSuggestionDeps {
  keywordOpportunityRepository: KeywordOpportunityRepositoryPort;
  contentEnrichment: ContentEnrichmentPort;
  contentSuggestionRepository: ContentSuggestionRepositoryPort;
}

export class GenerateContentSuggestionUseCase {
  constructor(private readonly deps: GenerateContentSuggestionDeps) {}

  async execute(
    projectId: string,
    keywordOpportunityId: string
  ): Promise<Result<ContentSuggestion, KeywordOpportunityNotFoundError | NoLlmProviderConfiguredError | ContentGenerationFailedError>> {
    const opportunity = await this.deps.keywordOpportunityRepository.findById(keywordOpportunityId);
    // Scoped to projectId, not just existence — without this check, a
    // crafted opportunity id from a different project would still resolve,
    // the same cross-project leak requireProjectAccess prevents one layer
    // up at the HTTP boundary.
    if (!opportunity || opportunity.projectId !== projectId) {
      return err(new KeywordOpportunityNotFoundError(`KeywordOpportunity "${keywordOpportunityId}" not found`));
    }

    let content: string;
    try {
      content = await this.deps.contentEnrichment.generateSuggestion({
        pageUrl: opportunity.pageUrl,
        query: opportunity.query,
        position: opportunity.position,
        impressions: opportunity.impressions,
      });
    } catch (error) {
      if (error instanceof NoLlmProviderConfiguredError) return err(error);
      return err(new ContentGenerationFailedError(error instanceof Error ? error.message : String(error)));
    }

    const suggestion = ContentSuggestion.create(opportunity.id, content);
    await this.deps.contentSuggestionRepository.save(suggestion);
    return ok(suggestion);
  }
}
