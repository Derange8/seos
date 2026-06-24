import type { PageContentDraft } from "@/domain/content-enrichment/entities/page-content-draft";

export interface PageContentDraftRepositoryPort {
  // One row per (project, page) — regenerating a page's draft overwrites it.
  save(draft: PageContentDraft): Promise<void>;
  findByProjectId(projectId: string): Promise<PageContentDraft[]>;
}
