import type { PrismaClient, PageContentDraft as PrismaPageContentDraftRow } from "@/generated/prisma/client";
import type { PageContentDraftRepositoryPort } from "@/application/content-enrichment/ports/page-content-draft-repository-port";
import {
  PageContentDraft,
  isDraftBodySection,
  isDraftFaq,
  type DraftBodySection,
  type DraftFaq,
} from "@/domain/content-enrichment/entities/page-content-draft";

// Same defensive-coercion reasoning as prisma-page-repository.ts's
// toDomainFaqs — these JSON columns aren't shape-checked by SQLite, so
// reading them back re-applies the same validation the providers apply to
// raw LLM output.
function toDomainSections(raw: unknown): DraftBodySection[] {
  return Array.isArray(raw) ? raw.filter(isDraftBodySection) : [];
}

function toDomainFaqs(raw: unknown): DraftFaq[] {
  return Array.isArray(raw) ? raw.filter(isDraftFaq) : [];
}

function toDomain(row: PrismaPageContentDraftRow): PageContentDraft {
  return PageContentDraft.reconstitute({
    id: row.id,
    projectId: row.projectId,
    pageUrl: row.pageUrl,
    suggestedTitle: row.suggestedTitle,
    suggestedMetaDescription: row.suggestedMetaDescription,
    bodySections: toDomainSections(row.bodySections),
    faqs: toDomainFaqs(row.faqs),
    generatedAt: row.generatedAt,
    status: row.status,
    previousTitle: row.previousTitle,
    previousMetaDescription: row.previousMetaDescription,
    previousContent: row.previousContent,
  });
}

export class PrismaPageContentDraftRepository implements PageContentDraftRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async save(draft: PageContentDraft): Promise<void> {
    // Regenerating a page's draft (a brand-new PageContentDraft.create())
    // always carries status: "DRAFT" / previousX: null — the update branch
    // writes those through too, so a re-generated draft correctly loses any
    // stale PUBLISHED state from a now-superseded earlier version of itself.
    const data = {
      suggestedTitle: draft.suggestedTitle,
      suggestedMetaDescription: draft.suggestedMetaDescription,
      bodySections: draft.bodySections as object,
      faqs: draft.faqs as object,
      status: draft.status,
      previousTitle: draft.previousTitle,
      previousMetaDescription: draft.previousMetaDescription,
      previousContent: draft.previousContent,
    };

    await this.client.pageContentDraft.upsert({
      where: { projectId_pageUrl: { projectId: draft.projectId, pageUrl: draft.pageUrl } },
      create: {
        id: draft.id,
        projectId: draft.projectId,
        pageUrl: draft.pageUrl,
        ...data,
      },
      update: { ...data, generatedAt: draft.generatedAt },
    });
  }

  async findByProjectId(projectId: string): Promise<PageContentDraft[]> {
    const rows = await this.client.pageContentDraft.findMany({ where: { projectId } });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<PageContentDraft | null> {
    const row = await this.client.pageContentDraft.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }
}
