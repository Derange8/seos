import type { KeywordCannibalizationIssue } from "@/domain/tracking/entities/keyword-cannibalization";

export interface KeywordCannibalizationRepositoryPort {
  // Deletes every existing issue for this project and inserts the fresh
  // set — not an upsert-by-key like KeywordOpportunityRepositoryPort,
  // because a query that's no longer cannibalized needs to disappear from
  // the list, not linger as a stale issue forever.
  replaceForProject(projectId: string, issues: readonly KeywordCannibalizationIssue[]): Promise<void>;
  findByProjectId(projectId: string): Promise<KeywordCannibalizationIssue[]>;
}
