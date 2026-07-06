import type { Citation } from "@/application/ai-visibility/ports/ai-visibility-model-port";

// Does a web-grounded answer cite the target's own domain? This is the
// "citation" signal — stronger and more measurable than a body-text mention:
// a source in the answer's reference list is the currency of AI search.
//
// Matching is on the registrable domain, not an exact host: a citation to
// `blog.acme.com` or `www.acme.com` counts for target `acme.com` (same site,
// different subdomain), but `notacme.com` and `acme.com.evil.com` must NOT —
// so we compare host suffixes on a dot boundary, never a bare substring.
//
// Deliberately dependency-free (no public-suffix list): the target domain is
// user-supplied config for a single project, so exact-or-subdomain matching is
// both correct enough and fully deterministic/testable. If multi-TLD edge
// cases ever matter, this one function is where a psl would slot in.

// Normalizes a domain or URL to a bare lowercase host with no scheme, port,
// path, or leading "www.". Returns null when there's no usable host.
export function normalizeHost(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) return null;

  let host: string;
  try {
    // Accept both full URLs ("https://acme.com/x") and bare domains
    // ("acme.com") — prefix a scheme for the latter so URL() can parse it.
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    host = new URL(withScheme).hostname;
  } catch {
    return null;
  }

  if (host.length === 0) return null;
  return host.startsWith("www.") ? host.slice(4) : host;
}

// True when `candidate` is the target host itself or a subdomain of it.
// Suffix check is on a dot boundary so "notacme.com" doesn't match "acme.com".
function hostBelongsToDomain(candidate: string, targetDomain: string): boolean {
  return candidate === targetDomain || candidate.endsWith(`.${targetDomain}`);
}

// Does any citation in this answer point at the target's own domain?
export function citesDomain(citations: readonly Citation[], targetDomain: string): boolean {
  const target = normalizeHost(targetDomain);
  if (target === null) return false;

  return citations.some((c) => {
    const host = normalizeHost(c.url);
    return host !== null && hostBelongsToDomain(host, target);
  });
}
