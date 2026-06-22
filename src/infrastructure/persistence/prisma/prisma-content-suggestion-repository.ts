import type { PrismaClient } from "@/generated/prisma/client";
import type { ContentSuggestionRepositoryPort } from "@/application/content-enrichment/ports/content-suggestion-repository-port";
import { ContentSuggestion } from "@/domain/content-enrichment/entities/content-suggestion";

export class PrismaContentSuggestionRepository implements ContentSuggestionRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async save(suggestion: ContentSuggestion): Promise<void> {
    await this.client.contentSuggestion.upsert({
      where: { keywordOpportunityId: suggestion.keywordOpportunityId },
      create: {
        id: suggestion.id,
        keywordOpportunityId: suggestion.keywordOpportunityId,
        content: suggestion.content,
      },
      update: { content: suggestion.content },
    });
  }

  async findByProjectId(projectId: string): Promise<ContentSuggestion[]> {
    const rows = await this.client.contentSuggestion.findMany({
      where: { keywordOpportunity: { projectId } },
    });

    return rows.map((row) =>
      ContentSuggestion.reconstitute({
        id: row.id,
        keywordOpportunityId: row.keywordOpportunityId,
        content: row.content,
        createdAt: row.createdAt,
      })
    );
  }
}
