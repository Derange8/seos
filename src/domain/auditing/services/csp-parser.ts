// Deliberately practical, not spec-complete: covers the source-list forms
// that actually show up in real CSP headers (exact origins, scheme-only
// wildcards like "https:", subdomain wildcards like "*.example.com", bare
// hostnames, and the keyword/nonce/hash tokens that never match an
// external origin) — not nonce-rotation timing, strict-dynamic propagation,
// or report-only mode. Good enough to answer "would the browser block this
// specific external script", not a CSP validator.
const NEVER_MATCHES_EXTERNAL_ORIGIN = new Set([
  "'none'",
  "'self'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  "'unsafe-hashes'",
  "'strict-dynamic'",
  "'report-sample'",
]);

export interface CspDirectives {
  readonly [directiveName: string]: readonly string[];
}

// CSP directives are semicolon-separated, each one a directive name
// followed by space-separated source values (e.g.
// "script-src 'self' https://example.com; style-src 'self'").
export function parseCspHeader(header: string): CspDirectives {
  const directives: Record<string, string[]> = {};
  for (const rawDirective of header.split(";")) {
    const trimmed = rawDirective.trim();
    if (!trimmed) continue;
    const [name, ...values] = trimmed.split(/\s+/);
    if (!name) continue;
    directives[name.toLowerCase()] = values;
  }
  return directives;
}

function sourceAllowsOrigin(source: string, origin: URL): boolean {
  const lowered = source.toLowerCase();
  if (NEVER_MATCHES_EXTERNAL_ORIGIN.has(lowered) || lowered.startsWith("'nonce-") || lowered.startsWith("'sha")) {
    return false;
  }
  if (source === "*") return true;

  // Scheme-only wildcard, e.g. "https:" — matches any host on that scheme.
  if (/^[a-z][a-z0-9+.-]*:$/i.test(source)) {
    return lowered.slice(0, -1) === origin.protocol.slice(0, -1);
  }

  let scheme: string | null = null;
  let rest = source;
  const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\//i.exec(source);
  if (schemeMatch?.[1]) {
    scheme = schemeMatch[1].toLowerCase();
    rest = source.slice(schemeMatch[0].length);
  }
  if (scheme && scheme !== origin.protocol.slice(0, -1)) return false;

  const [hostPart, portPart] = rest.split(":");
  if (!hostPart) return false;
  if (portPart && portPart !== "*") {
    const originPort = origin.port || (origin.protocol === "https:" ? "443" : "80");
    if (portPart !== originPort) return false;
  }

  if (hostPart.startsWith("*.")) {
    const suffix = hostPart.slice(1); // keep the leading "." — ".example.com"
    return origin.hostname.toLowerCase().endsWith(suffix.toLowerCase()) && origin.hostname.toLowerCase() !== hostPart.slice(2).toLowerCase();
  }
  return hostPart.toLowerCase() === origin.hostname.toLowerCase();
}

// null means "this directive (and its default-src fallback) isn't present
// at all" — i.e. CSP doesn't restrict scripts on this page, not "every
// origin is blocked."
export function effectiveScriptSources(directives: CspDirectives): readonly string[] | null {
  return directives["script-src"] ?? directives["default-src"] ?? null;
}

export function isOriginAllowedByCsp(origin: string, sources: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return true; // an origin we can't parse isn't one we can confidently flag as blocked
  }
  return sources.some((source) => sourceAllowsOrigin(source, parsed));
}
