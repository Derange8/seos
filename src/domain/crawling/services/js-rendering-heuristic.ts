// Crawler Engine design §6: default to plain HTTP, escalate to Playwright
// rendering only for pages this heuristic flags as JS-dependent. False
// negatives are acceptable for v1 (mitigated by a per-project manual
// override at the use-case level); keep this swappable/versioned rather
// than inlined into the worker.
const SPA_SHELL_PATTERNS: readonly RegExp[] = [/<div[^>]*id=["']root["']/i, /<div[^>]*id=["']app["']/i];
const NOSCRIPT_WARNING_PATTERN = /<noscript>[^<]*enable\s+javascript/i;
const NEAR_EMPTY_VISIBLE_TEXT_THRESHOLD = 200;

export function needsRendering(html: string): boolean {
  if (NOSCRIPT_WARNING_PATTERN.test(html)) {
    return true;
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch?.[1] ?? html;
  const visibleText = bodyContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const looksLikeSpaShell = SPA_SHELL_PATTERNS.some((pattern) => pattern.test(bodyContent));

  return looksLikeSpaShell && visibleText.length < NEAR_EMPTY_VISIBLE_TEXT_THRESHOLD;
}
