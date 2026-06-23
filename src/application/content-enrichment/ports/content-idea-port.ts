export { NoLlmProviderConfiguredError } from "@/application/content-enrichment/ports/content-enrichment-port";

export interface ContentIdeaPageContext {
  pageUrl: string;
  title: string | null;
  h1: string | null;
}

export interface ContentIdeaSuggestion {
  pageUrl: string;
  topic: string;
  suggestedTitle: string;
  suggestedSlug: string;
  rationale: string;
}

// Single batched call across a project's pages — there's no "per page"
// cost-control concern here the way ContentEnrichmentPort has per
// KeywordOpportunity, since this only ever runs when a user explicitly
// clicks "Generate content ideas" for the whole project, not automatically.
export interface ContentIdeaPort {
  generateContentIdeas(pages: readonly ContentIdeaPageContext[]): Promise<ContentIdeaSuggestion[]>;
}
