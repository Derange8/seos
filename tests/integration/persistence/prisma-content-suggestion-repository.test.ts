import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaContentSuggestionRepository } from "@/infrastructure/persistence/prisma/prisma-content-suggestion-repository";
import { PrismaKeywordOpportunityRepository } from "@/infrastructure/persistence/prisma/prisma-keyword-opportunity-repository";
import { ContentSuggestion } from "@/domain/content-enrichment/entities/content-suggestion";
import { KeywordOpportunity } from "@/domain/tracking/entities/keyword-opportunity";

describe("PrismaContentSuggestionRepository", () => {
  const repository = new PrismaContentSuggestionRepository(prisma);
  const keywordOpportunityRepository = new PrismaKeywordOpportunityRepository(prisma);
  let projectId: string;
  let opportunityId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Content Suggestion Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;

    await keywordOpportunityRepository.saveMany([
      KeywordOpportunity.create(projectId, "https://example.com/a", "query a", 1, 100, 0.05, 12),
    ]);
    const [opportunity] = await keywordOpportunityRepository.findByProjectId(projectId);
    opportunityId = opportunity.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("saves and retrieves a suggestion for its project", async () => {
    await repository.save(ContentSuggestion.create(opportunityId, "Add a comparison section."));

    const found = await repository.findByProjectId(projectId);
    expect(found).toHaveLength(1);
    expect(found[0].content).toBe("Add a comparison section.");
    expect(found[0].keywordOpportunityId).toBe(opportunityId);
  });

  it("overwrites the suggestion for an already-stored opportunity rather than duplicating it", async () => {
    await repository.save(ContentSuggestion.create(opportunityId, "First draft."));
    await repository.save(ContentSuggestion.create(opportunityId, "Regenerated draft."));

    const rows = await prisma.contentSuggestion.findMany({ where: { keywordOpportunityId: opportunityId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe("Regenerated draft.");
  });
});
