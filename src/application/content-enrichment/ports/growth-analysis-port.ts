import type { ConversionOpportunity, GrowthOpportunity } from "@/domain/content-enrichment/entities/growth-analysis";

export { NoLlmProviderConfiguredError } from "@/application/content-enrichment/ports/content-enrichment-port";

export interface GrowthAnalysisPageContext {
  pageUrl: string;
  title: string | null;
  h1: string | null;
  contentExcerpt: string | null;
  faqCount: number;
}

export interface GrowthAnalysisResult {
  businessUnderstanding: string;
  contentGapsSummary: string;
  opportunities: readonly GrowthOpportunity[];
  conversionOpportunities: readonly ConversionOpportunity[];
  missingCompetitorPages: readonly string[];
  topPages: readonly string[];
  executiveSummary: string;
}

// One call across ALL of a project's crawled pages at once — the whole
// point of this port is reasoning that spans pages (catalog-level gaps a
// per-page call can't see), unlike ContentIdeaPort/ContentEnrichmentPort
// which are deliberately page-scoped.
export interface GrowthAnalysisPort {
  generateGrowthAnalysis(pages: readonly GrowthAnalysisPageContext[]): Promise<GrowthAnalysisResult>;
}
