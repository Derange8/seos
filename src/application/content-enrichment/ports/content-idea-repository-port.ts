import type { ContentIdea } from "@/domain/content-enrichment/entities/content-idea";

export interface ContentIdeaRepositoryPort {
  // Atomically swaps the project's whole batch — a regeneration is meant
  // to reflect the current crawl, not accumulate alongside stale ideas
  // from a previous one.
  replaceForProject(projectId: string, ideas: readonly ContentIdea[]): Promise<void>;
  findByProjectId(projectId: string): Promise<ContentIdea[]>;
}
