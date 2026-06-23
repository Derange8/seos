import type { PrismaClient } from "@/generated/prisma/client";
import type { ContentIdeaRepositoryPort } from "@/application/content-enrichment/ports/content-idea-repository-port";
import { ContentIdea } from "@/domain/content-enrichment/entities/content-idea";

export class PrismaContentIdeaRepository implements ContentIdeaRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async replaceForProject(projectId: string, ideas: readonly ContentIdea[]): Promise<void> {
    await this.client.$transaction([
      this.client.contentIdea.deleteMany({ where: { projectId } }),
      this.client.contentIdea.createMany({
        data: ideas.map((idea) => ({
          id: idea.id,
          projectId: idea.projectId,
          sourcePageUrl: idea.sourcePageUrl,
          topic: idea.topic,
          suggestedTitle: idea.suggestedTitle,
          suggestedSlug: idea.suggestedSlug,
          rationale: idea.rationale,
          createdAt: idea.createdAt,
        })),
      }),
    ]);
  }

  async findByProjectId(projectId: string): Promise<ContentIdea[]> {
    const rows = await this.client.contentIdea.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) =>
      ContentIdea.reconstitute({
        id: row.id,
        projectId: row.projectId,
        sourcePageUrl: row.sourcePageUrl,
        topic: row.topic,
        suggestedTitle: row.suggestedTitle,
        suggestedSlug: row.suggestedSlug,
        rationale: row.rationale,
        createdAt: row.createdAt,
      })
    );
  }
}
