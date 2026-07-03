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
}
