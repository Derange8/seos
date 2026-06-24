// Strips a markdown code fence (some models wrap JSON in ```json ... ```
// even when told not to) and parses the result, throwing one consistent
// error on failure. Shared by every LLM provider's response parser so the
// same fence-handling + parse boilerplate isn't repeated per feature.
export function parseJsonFromLlm(content: string): unknown {
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(stripped);
  } catch {
    throw new Error("LLM response content was not valid JSON");
  }
}
