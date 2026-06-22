import { DomainError } from "@/shared/domain-error";
import { err, ok, type Result } from "@/shared/result";

export class InvalidUrlError extends DomainError {
  readonly code = "INVALID_URL";
}

const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);

// Common tracking/session parameters stripped during normalization so they
// don't cause the same page to be discovered/queued as if it were distinct.
const TRACKING_PARAM_PATTERNS: readonly RegExp[] = [
  /^utm_/i,
  /^gclid$/i,
  /^fbclid$/i,
  /^msclkid$/i,
  /^mc_eid$/i,
  /^mc_cid$/i,
  /^_ga$/i,
  /^_gl$/i,
  /^ref$/i,
  /^igshid$/i,
];

function isTrackingParam(key: string): boolean {
  return TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(key));
}

// Strips tracking params and sorts the remainder by key so that param order
// never causes two otherwise-identical URLs to be treated as distinct.
function normalizeQuery(parsed: URL): void {
  const kept = Array.from(parsed.searchParams.entries())
    .filter(([key]) => !isTrackingParam(key))
    .sort(([a], [b]) => a.localeCompare(b));

  const next = new URLSearchParams();
  for (const [key, value] of kept) {
    next.append(key, value);
  }
  parsed.search = next.toString();
}

// The WHATWG URL parser preserves whatever percent-encoding case the input
// used (e.g. %2f vs %2F); normalize it so equivalent paths dedupe correctly.
function normalizePathEncoding(parsed: URL): void {
  parsed.pathname = parsed.pathname.replace(/%[0-9a-fA-F]{2}/g, (match) =>
    match.toUpperCase()
  );
}

export class Url {
  private constructor(private readonly parsed: URL) {}

  static create(input: string): Result<Url, InvalidUrlError> {
    let parsed: URL;
    try {
      parsed = new URL(input);
    } catch {
      return err(new InvalidUrlError(`"${input}" is not a valid URL`));
    }

    if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
      return err(new InvalidUrlError(`Unsupported protocol "${parsed.protocol}" in "${input}"`));
    }

    // Host casing, default ports (:443/:80), and an empty path defaulting to
    // "/" are already normalized by the WHATWG URL parser itself.
    parsed.hash = "";
    normalizePathEncoding(parsed);
    normalizeQuery(parsed);

    return ok(new Url(parsed));
  }

  get href(): string {
    return this.parsed.href;
  }

  get hostname(): string {
    return this.parsed.hostname;
  }

  get origin(): string {
    return this.parsed.origin;
  }

  get pathname(): string {
    return this.parsed.pathname;
  }

  isSameOrigin(other: Url): boolean {
    return this.origin === other.origin;
  }

  equals(other: Url): boolean {
    return this.href === other.href;
  }

  toString(): string {
    return this.href;
  }
}
