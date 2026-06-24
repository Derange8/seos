import type { DraftBodySection, DraftFaq } from "@/domain/content-enrichment/entities/page-content-draft";

export { NoLlmProviderConfiguredError } from "@/application/content-enrichment/ports/content-enrichment-port";

export interface PageContentDraftContext {
  pageUrl: string;
  title: string | null;
  h1: string | null;
  contentExcerpt: string | null;
  existingFaqCount: number;
}

export interface PageContentDraftResult {
  suggestedTitle: string;
  suggestedMetaDescription: string;
  bodySections: readonly DraftBodySection[];
  faqs: readonly DraftFaq[];
}

// Single-page, on-demand generation (one real LLM call per click), same
// cost-control reasoning as ContentEnrichmentPort — a draft is only worth
// the spend when the user explicitly asks for one page.
export interface PageContentDraftPort {
  generateDraft(context: PageContentDraftContext): Promise<PageContentDraftResult>;
}
