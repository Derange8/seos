import { CRAWLER_PRODUCT_TOKEN } from "@/domain/crawling/value-objects/crawler-identity";

type RuleType = "allow" | "disallow";

interface Rule {
  type: RuleType;
  pattern: string;
  regex: RegExp;
}

interface Group {
  userAgents: string[];
  rules: Rule[];
  crawlDelaySeconds: number | null;
}

// Robots Exclusion Protocol (RFC 9309) path-pattern matching: a literal
// "*" means "match anything here", and a trailing "$" anchors the end of
// the path (without it, the pattern only has to match a *prefix*). Every
// other character is matched literally — this is intentionally not a full
// glob/regex engine, just the two wildcards the spec actually defines.
function compilePattern(pattern: string): RegExp {
  const hasEndAnchor = pattern.endsWith("$");
  const body = hasEndAnchor ? pattern.slice(0, -1) : pattern;
  const escaped = body
    .split("*")
    .map((segment) => segment.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}${hasEndAnchor ? "$" : ""}`);
}

// Splits raw robots.txt text into User-agent groups. Per the spec, one or
// more consecutive "User-agent:" lines share whatever Allow/Disallow/
// Crawl-delay lines follow them, up until the next User-agent line that
// doesn't immediately continue the same block.
function parseGroups(raw: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastLineWasUserAgent = false;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (line.length === 0) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const directive = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    if (directive === "user-agent") {
      if (current && lastLineWasUserAgent) {
        current.userAgents.push(value.toLowerCase());
      } else {
        current = { userAgents: [value.toLowerCase()], rules: [], crawlDelaySeconds: null };
        groups.push(current);
      }
      lastLineWasUserAgent = true;
      continue;
    }
    lastLineWasUserAgent = false;
    if (!current) continue; // directives before any User-agent line are meaningless

    if (directive === "disallow" || directive === "allow") {
      if (value.length === 0 && directive === "disallow") continue; // "Disallow:" (empty) means "block nothing"
      current.rules.push({ type: directive, pattern: value, regex: compilePattern(value) });
    } else if (directive === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelaySeconds = seconds;
    }
  }

  return groups;
}

function matchesProductToken(groupAgent: string, productToken: string): boolean {
  if (groupAgent === "*") return false; // wildcard is only used as a fallback, never a "specific" match
  const token = productToken.toLowerCase();
  return token.includes(groupAgent) || groupAgent.includes(token);
}

// Merges every group whose rules apply to our bot (RFC 9309 §2.2.1: rules
// from all matching groups combine, not just the first found). This
// matters in practice — e.g. Cloudflare-managed robots.txt files commonly
// emit a "User-agent: *" block of their own ahead of the site's own,
// separate "User-agent: *" block; picking only the first would silently
// ignore every Disallow the site operator actually wrote. Falls back to
// merging all "*" groups when no specific group names our bot, and to "no
// rules apply" (everything allowed) when there's no wildcard group either.
function selectGroup(groups: readonly Group[], productToken: string): Group | null {
  const specific = groups.filter((group) => group.userAgents.some((agent) => matchesProductToken(agent, productToken)));
  const matching = specific.length > 0 ? specific : groups.filter((group) => group.userAgents.includes("*"));
  if (matching.length === 0) return null;

  return {
    userAgents: matching.flatMap((group) => group.userAgents),
    rules: matching.flatMap((group) => group.rules),
    // First-specified Crawl-delay wins among the matching groups — taking
    // the smallest/largest would be arbitrary; the spec doesn't define
    // merge semantics for conflicting delays, so "first wins" is at least
    // deterministic and matches how most parsers behave in practice.
    crawlDelaySeconds: matching.find((group) => group.crawlDelaySeconds !== null)?.crawlDelaySeconds ?? null,
  };
}

// Parsed, queryable robots.txt rules for one crawler identity. Parsing
// (this file) is pure domain logic; fetching the raw text is an I/O
// concern handled by RobotsPort/HttpRobotsFetcher.
export class RobotsRules {
  private constructor(
    private readonly group: Group | null
  ) {}

  static parse(raw: string, productToken: string = CRAWLER_PRODUCT_TOKEN): RobotsRules {
    return new RobotsRules(selectGroup(parseGroups(raw), productToken));
  }

  // No robots.txt found at all (404) — everything is allowed, no delay.
  static allowAll(): RobotsRules {
    return new RobotsRules(null);
  }

  isAllowed(path: string): boolean {
    if (!this.group) return true;

    // Longest matching pattern wins (RFC 9309 §2.2.2); Allow wins a tie
    // against Disallow of the same length.
    let best: Rule | null = null;
    for (const rule of this.group.rules) {
      if (!rule.regex.test(path)) continue;
      if (!best || rule.pattern.length > best.pattern.length) {
        best = rule;
      } else if (rule.pattern.length === best.pattern.length && rule.type === "allow") {
        best = rule;
      }
    }

    return best === null || best.type === "allow";
  }

  get crawlDelaySeconds(): number | null {
    return this.group?.crawlDelaySeconds ?? null;
  }
}
