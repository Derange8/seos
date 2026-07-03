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

// The AI answer engine as a queryable oracle. Implemented in infrastructure
// by reusing the existing multi-provider LLM setup (see LlmSettings /
// DynamicRecommendationProvider) — the probe just needs raw ask + a yes/no
// judgement, not the recommendation-specific shape of LLMPort.
export interface AiVisibilityModelPort {
  // Ask the model a buyer-intent query as a plain user would, return its
  // answer text.
  ask(query: string): Promise<string>;
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
}
