// Grounding context for suggesting what to probe: the business plus a few
// representative crawled page titles/H1s (may be empty for an un-crawled
// project — the model still works from brand/domain alone).
export interface ProbeTargetSuggestionInput {
  brand: string;
  domain: string;
  pageHints: string[];
}

export interface ProbeTargetSuggestion {
  queries: string[];
  competitors: string[];
}

// Diagnosis context for one query the business isn't winning: what would the
// model need to start recommending this business here?
export interface VisibilityGapInput {
  query: string;
  brand: string;
  domain: string;
  // Competitors the probe saw win this query, for sharper grounding (may be
  // empty).
  competitors: string[];
}

// Input for drafting a citation-optimized page targeting a query the business
// wants to win, guided by the diagnosis gaps.
export interface CitationContentInput {
  query: string;
  brand: string;
  domain: string;
  gaps: string[];
}

export interface CitationDraftSection {
  heading: string;
  body: string;
}

export interface CitationDraft {
  title: string;
  metaDescription: string;
  sections: CitationDraftSection[];
  faqs: { question: string; answer: string }[];
}

// How the probe reached its answer:
//  - "parametric":   the model answered from its training memory alone (no
//                    web search). Fast and cheap, but measures what the model
//                    "remembers", not what a real AI-search user sees today.
//  - "web_grounded": the model ran a live web search and answered from
//                    retrieved sources. This is the real AI-search surface —
//                    and the only mode that can produce citations.
export type GroundingMode = "parametric" | "web_grounded";

// One source the model cited in a web-grounded answer. Whether this source
// belongs to the target's own domain (or a competitor) is decided in the
// domain layer against the ProbeTarget — the adapter only reports the raw URL
// it was given, so URL-normalization/domain-matching lives in one place.
export interface Citation {
  url: string;
  title?: string;
}

// The outcome of one `ask`: the answer text (as before) plus, in
// web_grounded mode, the sources the model cited. In parametric mode
// `citations` is always empty (no web search happened) and that is an honest
// reading, not a failure.
export interface AskResult {
  answer: string;
  citations: Citation[];
  groundingMode: GroundingMode;
}

// The AI answer engine as a queryable oracle. Implemented in infrastructure
// by reusing the existing multi-provider LLM setup (see LlmSettings /
// DynamicRecommendationProvider) — the probe just needs raw ask + a yes/no
// judgement, not the recommendation-specific shape of LLMPort.
export interface AiVisibilityModelPort {
  // Ask the model a buyer-intent query as a plain user would. `mode` is
  // explicit on every call (never a silent fallback): a parametric answer and
  // a web-grounded answer measure genuinely different things, so which one was
  // taken is part of the result. An adapter that cannot honor `web_grounded`
  // (e.g. a provider with no web-search tool) must reject, not quietly degrade
  // to parametric — that would be a measurement lie.
  ask(query: string, mode: GroundingMode): Promise<AskResult>;
  // Does this answer name at least one specific, real platform/product (a
  // brand), as opposed to a generic non-committal answer? Splits OPEN from
  // CONTESTED for platforms not in the target's known-competitor list.
  namesSpecificOption(answer: string): Promise<boolean>;
  // Propose buyer-intent queries (and likely competitor brands) worth
  // probing for this business, so the user doesn't have to hand-write them.
  suggestProbeTarget(input: ProbeTargetSuggestionInput): Promise<ProbeTargetSuggestion>;
  // For a query the business isn't recommended for, ask the model what
  // concrete gaps it would need closed to start recommending it — the
  // "close the loop" diagnosis. Returns actionable gap statements.
  diagnoseVisibilityGap(input: VisibilityGapInput): Promise<string[]>;
  // Draft a citation-optimized page for a target query, guided by the
  // diagnosis gaps — the "act" step that turns a diagnosis into content.
  generateCitationContent(input: CitationContentInput): Promise<CitationDraft>;
}
