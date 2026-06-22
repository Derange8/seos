import { DomainError } from "@/shared/domain-error";

export class NoLlmProviderConfiguredError extends DomainError {
  readonly code = "NO_LLM_PROVIDER_CONFIGURED";
}

export interface ContentEnrichmentContext {
  pageUrl: string;
  query: string;
  position: number;
  impressions: number;
}

// Single-item, on-demand generation — unlike LLMPort.generateRecommendations
// (one batched call per AuditRun, for every issue at once), a content
// suggestion is only worth the API cost when a user actually asks for one
// on a specific opportunity, so there's no batching contract here.
export interface ContentEnrichmentPort {
  generateSuggestion(context: ContentEnrichmentContext): Promise<string>;
}
