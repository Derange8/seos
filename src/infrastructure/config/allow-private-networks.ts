// Off by default everywhere (crawler, robots fetcher, WordPress REST
// client) — the private-network guard exists specifically to stop the app
// from being tricked into hitting a user's internal network. The one
// legitimate reason to flip it is local development/testing against a
// site that's genuinely running on localhost or a LAN address (e.g. a
// Docker WordPress instance) — opt-in only, via an explicit env var, never
// inferred from anything request-controlled.
export function shouldAllowPrivateNetworks(): boolean {
  return process.env.SEOS_ALLOW_PRIVATE_NETWORKS === "true";
}
