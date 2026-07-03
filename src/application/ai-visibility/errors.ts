import { DomainError } from "@/shared/domain-error";

// Thrown when a probe is requested but no LLM provider is configured in
// Settings. Unlike audit recommendations (which fall back to a static
// template provider), an AI-visibility probe genuinely needs to query a
// real model — there is no meaningful offline substitute — so a missing
// provider is a real, surfaceable error. Shares the NO_LLM_PROVIDER_CONFIGURED
// code the content-ideas flow already uses, so the API route maps it to 409
// uniformly, but stays in this context rather than importing across bounded
// contexts.
export class AiVisibilityProviderNotConfiguredError extends DomainError {
  readonly code = "NO_LLM_PROVIDER_CONFIGURED";

  constructor() {
    super("No LLM provider configured — AI visibility probe requires one.");
  }
}
