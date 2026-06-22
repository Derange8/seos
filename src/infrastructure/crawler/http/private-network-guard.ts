import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

// SSRF guard: the crawler must never be usable to reach a server's own
// internal network (cloud metadata endpoints, internal admin panels,
// localhost services) just because an attacker can prove DNS ownership of
// some public-looking domain that happens to resolve to a private IP
// (e.g. a wildcard-DNS service like nip.io pointed at 169.254.169.254).
// Domain ownership verification answers "do you own this name", not
// "where is it allowed to resolve to" — this is the second, independent
// check.
//
// Known limitation: this checks the IP at request time, not the IP the
// underlying TCP connection actually uses — a DNS-rebinding attacker who
// changes the record between this check and the fetch could still slip
// through. That's a meaningfully harder attack than the common case this
// blocks (a domain that simply resolves to a private range), and isn't
// addressed here; pinning the resolved IP for the actual connection would
// close that gap if it's ever needed.

const IPV4_RESERVED_RANGES: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // shared address space (CGNAT)
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (cloud metadata endpoints live here)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation (TEST-NET-1)
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation (TEST-NET-2)
  ["203.0.113.0", 24], // documentation (TEST-NET-3)
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isIpv4InRange(ip: string, base: string, prefixLength: number): boolean {
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  return IPV4_RESERVED_RANGES.some(([base, prefix]) => isIpv4InRange(ip, base, prefix));
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local (fc00::/7)
  if (/^fe[89ab]/.test(normalized)) return true; // link-local (fe80::/10)

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — unwrap and re-check as IPv4 rather
  // than letting it slip through as "not a recognized v6 private range".
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateOrReservedIpv4(mapped[1]);

  return false;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateOrReservedIpv4(ip);
  if (version === 6) return isPrivateOrReservedIpv6(ip);
  // Not a parseable IP at all — fail closed rather than guess.
  return true;
}

// Shared by both fetch paths (HttpPageFetcher and PlaywrightPageRenderer —
// a headless browser can be made to SSRF too, e.g. a malicious page's own
// JS calling fetch() against an internal address from inside our process).
// Returns the blocking address for a clearer error message, or null if the
// hostname is safe to reach. A lookup failure returns null rather than
// surfacing here — that's a DNS error the caller's own request/navigation
// will report with its own, more specific error code.
export async function findPrivateNetworkAddress(hostname: string): Promise<string | null> {
  try {
    const addresses = await lookup(hostname, { all: true });
    return addresses.find((address) => isPrivateOrReservedIp(address.address))?.address ?? null;
  } catch {
    return null;
  }
}
