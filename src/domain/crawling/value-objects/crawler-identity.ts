// Single source of truth for the crawler's own User-Agent — used both for
// the actual page-fetch request header (http-page-fetcher.ts) and for
// matching against robots.txt User-agent groups (robots-rules.ts). Keeping
// these as one constant means the bot can never drift out of sync with the
// identity it advertises to robots.txt.
export const CRAWLER_USER_AGENT = "SeosBot/1.0 (+https://seos.example/bot)";

// The "product token" robots.txt User-agent lines are matched against —
// the part before the first "/", per the Robots Exclusion Protocol (RFC
// 9309 §2.2.1).
export const CRAWLER_PRODUCT_TOKEN = CRAWLER_USER_AGENT.split("/")[0];
