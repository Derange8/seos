import { parseJsonFromLlm } from "@/infrastructure/llm/llm-json";
import type {
  ProbeTargetSuggestion,
  ProbeTargetSuggestionInput,
} from "@/application/ai-visibility/ports/ai-visibility-model-port";

const MAX_QUERIES = 10;
const MAX_COMPETITORS = 8;

export const SUGGEST_SYSTEM =
  "You help measure how visible a business is in AI answer engines. Given a " +
  "business (brand, domain, and sample page titles), produce: (1) `queries` — " +
  "up to 8 realistic buyer-intent questions a potential customer might ask an " +
  "AI assistant, phrased naturally, where this business would ideally be " +
  "recommended; write them in the primary language implied by the page titles " +
  "(fall back to English). (2) `competitors` — up to 8 real competitor or " +
  "product brand names in the same category. Respond ONLY with a JSON object " +
  '{"queries": string[], "competitors": string[]} — no other text, no markdown.';

export function buildSuggestUserPrompt(input: ProbeTargetSuggestionInput): string {
  return JSON.stringify({ brand: input.brand, domain: input.domain, pageTitles: input.pageHints.slice(0, 30) });
}

function toStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, max);
}

export function parseSuggestion(content: string): ProbeTargetSuggestion {
  const parsed = parseJsonFromLlm(content);
  const obj = (parsed ?? {}) as Record<string, unknown>;
  return {
    queries: toStringArray(obj.queries, MAX_QUERIES),
    competitors: toStringArray(obj.competitors, MAX_COMPETITORS),
  };
}
