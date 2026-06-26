import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// A single redirect (chain length 1 — e.g. HTTP→HTTPS or a www-normalize)
// is normal and not flagged. 2+ hops before reaching this page is the
// actual "redirect chain" SEO tools warn about (slower, and each hop
// risks losing link-equity signal).
const MIN_CHAIN_LENGTH = 2;

export const redirectChainRule: AuditRule = {
  id: "redirect-chain",
  appliesToNoindexPages: true,
  evaluate(page: Page): AuditFinding[] {
    if (page.redirectChain.length < MIN_CHAIN_LENGTH) return [];
    return [
      {
        ruleId: "redirect-chain",
        category: "technical",
        severity: "WARNING",
        message: `${page.url.href} was reached via a ${page.redirectChain.length}-hop redirect chain: ${[...page.redirectChain, page.url.href].join(" → ")}`,
      },
    ];
  },
};
