import type { PageContentDraftRepositoryPort } from "@/application/content-enrichment/ports/page-content-draft-repository-port";
import type { PageContentDraft } from "@/domain/content-enrichment/entities/page-content-draft";

export class FakePageContentDraftRepository implements PageContentDraftRepositoryPort {
  private readonly byId = new Map<string, PageContentDraft>();

  seed(draft: PageContentDraft): void {
    this.byId.set(draft.id, draft);
  }

  async save(draft: PageContentDraft): Promise<void> {
    this.byId.set(draft.id, draft);
  }

  async findByProjectId(projectId: string): Promise<PageContentDraft[]> {
    return [...this.byId.values()].filter((draft) => draft.projectId === projectId);
  }

  async findById(id: string): Promise<PageContentDraft | null> {
    return this.byId.get(id) ?? null;
  }
}
