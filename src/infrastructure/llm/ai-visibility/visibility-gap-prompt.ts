import { parseJsonFromLlm } from "@/infrastructure/llm/llm-json";
import type { VisibilityGapInput } from "@/application/ai-visibility/ports/ai-visibility-model-port";

const MAX_GAPS = 6;

export const GAP_SYSTEM =
  "You are an expert on how AI assistants decide which businesses to " +
  "recommend. Given a buyer-intent query and a business that is NOT currently " +
  "recommended for it, explain concretely what that business would need — " +
  "specific content/pages, proof or credentials, positioning, or public " +
  "signals — for an AI assistant to start recommending it for this query. " +
  "Be concrete and actionable, not generic SEO advice. Return 3-5 gaps. " +
  'Respond ONLY with a JSON object {"gaps": string[]} — no other text, no ' +
  "markdown. Write the gaps in the query's language.";

export function buildGapUserPrompt(input: VisibilityGapInput): string {
  return JSON.stringify({
    query: input.query,
    brand: input.brand,
    domain: input.domain,
    currentlyRecommended: input.competitors,
  });
}

export function parseGaps(content: string): string[] {
  const parsed = parseJsonFromLlm(content);
  const gaps = (parsed as { gaps?: unknown })?.gaps;
  if (!Array.isArray(gaps)) return [];
  return gaps
    .filter((g): g is string => typeof g === "string")
    .map((g) => g.trim())
    .filter((g) => g.length > 0)
    .slice(0, MAX_GAPS);
}
