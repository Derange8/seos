import { describe, expect, it, vi } from "vitest";
import {
  ContentGenerationFailedError,
  GenerateContentSuggestionUseCase,
  KeywordOpportunityNotFoundError,
} from "@/application/content-enrichment/use-cases/generate-content-suggestion-use-case";
import { NoLlmProviderConfiguredError, type ContentEnrichmentPort } from "@/application/content-enrichment/ports/content-enrichment-port";
import type { ContentSuggestionRepositoryPort } from "@/application/content-enrichment/ports/content-suggestion-repository-port";
import type { KeywordOpportunityRepositoryPort } from "@/application/tracking/ports/keyword-opportunity-repository-port";
import { KeywordOpportunity } from "@/domain/tracking/entities/keyword-opportunity";

function buildOpportunity(projectId = "project-1"): KeywordOpportunity {
  return KeywordOpportunity.create(projectId, "https://example.com/blog/widgets", "best widgets", 10, 200, 0.05, 14);
}

function deps(
  overrides: Partial<{
    keywordOpportunityRepository: KeywordOpportunityRepositoryPort;
    contentEnrichment: ContentEnrichmentPort;
    contentSuggestionRepository: ContentSuggestionRepositoryPort;
  }> = {}
) {
  const opportunity = buildOpportunity();
  const keywordOpportunityRepository: KeywordOpportunityRepositoryPort =
    overrides.keywordOpportunityRepository ?? {
      saveMany: vi.fn(),
      findByProjectId: vi.fn(),
      findById: vi.fn().mockResolvedValue(opportunity),
    };
  const contentEnrichment: ContentEnrichmentPort =
    overrides.contentEnrichment ?? { generateSuggestion: vi.fn().mockResolvedValue("Add a comparison table.") };
  const contentSuggestionRepository: ContentSuggestionRepositoryPort =
    overrides.contentSuggestionRepository ?? { save: vi.fn().mockResolvedValue(undefined), findByProjectId: vi.fn() };
  return { keywordOpportunityRepository, contentEnrichment, contentSuggestionRepository, opportunity };
}

describe("GenerateContentSuggestionUseCase", () => {
  it("generates and saves a suggestion for a valid opportunity", async () => {
    const dependencies = deps();
    const useCase = new GenerateContentSuggestionUseCase(dependencies);

    const result = await useCase.execute("project-1", dependencies.opportunity.id);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.content).toBe("Add a comparison table.");
    expect(dependencies.contentSuggestionRepository.save).toHaveBeenCalledTimes(1);
  });

  it("passes the opportunity's page/query/position/impressions to the LLM port", async () => {
    const dependencies = deps();
    const useCase = new GenerateContentSuggestionUseCase(dependencies);

    await useCase.execute("project-1", dependencies.opportunity.id);

    expect(dependencies.contentEnrichment.generateSuggestion).toHaveBeenCalledWith({
      pageUrl: "https://example.com/blog/widgets",
      query: "best widgets",
      position: 14,
      impressions: 200,
    });
  });

  it("fails with KeywordOpportunityNotFoundError when the id doesn't exist", async () => {
    const dependencies = deps({
      keywordOpportunityRepository: { saveMany: vi.fn(), findByProjectId: vi.fn(), findById: vi.fn().mockResolvedValue(null) },
    });
    const useCase = new GenerateContentSuggestionUseCase(dependencies);

    const result = await useCase.execute("project-1", "does-not-exist");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(KeywordOpportunityNotFoundError);
  });

  it("fails with KeywordOpportunityNotFoundError when the opportunity belongs to a different project", async () => {
    const dependencies = deps();
    const useCase = new GenerateContentSuggestionUseCase(dependencies);

    const result = await useCase.execute("some-other-project", dependencies.opportunity.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(KeywordOpportunityNotFoundError);
    expect(dependencies.contentEnrichment.generateSuggestion).not.toHaveBeenCalled();
  });

  it("passes through NoLlmProviderConfiguredError from the LLM port", async () => {
    const dependencies = deps({
      contentEnrichment: { generateSuggestion: vi.fn().mockRejectedValue(new NoLlmProviderConfiguredError("no provider")) },
    });
    const useCase = new GenerateContentSuggestionUseCase(dependencies);

    const result = await useCase.execute("project-1", dependencies.opportunity.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NoLlmProviderConfiguredError);
    expect(dependencies.contentSuggestionRepository.save).not.toHaveBeenCalled();
  });

  it("wraps any other LLM port failure as ContentGenerationFailedError", async () => {
    const dependencies = deps({
      contentEnrichment: { generateSuggestion: vi.fn().mockRejectedValue(new Error("network blip")) },
    });
    const useCase = new GenerateContentSuggestionUseCase(dependencies);

    const result = await useCase.execute("project-1", dependencies.opportunity.id);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ContentGenerationFailedError);
      expect(result.error.message).toBe("network blip");
    }
  });
});
