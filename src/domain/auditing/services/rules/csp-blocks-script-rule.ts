import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";
import { effectiveScriptSources, isOriginAllowedByCsp, parseCspHeader } from "@/domain/auditing/services/csp-parser";

export const cspBlocksScriptRule: AuditRule = {
  id: "csp-blocks-script",
  // Security, not search-ranking — applies whether or not the page is
  // meant to be indexed.
  appliesToNoindexPages: true,
  evaluate(page: Page): AuditFinding[] {
    if (!page.cspHeader || page.externalScriptOrigins.length === 0) return [];

    const sources = effectiveScriptSources(parseCspHeader(page.cspHeader));
    if (sources === null) return [];

    const blockedOrigins = page.externalScriptOrigins.filter(
      (origin) => !isOriginAllowedByCsp(origin, sources)
    );
    if (blockedOrigins.length === 0) return [];

    return [
      {
        ruleId: "csp-blocks-script",
        category: "technical",
        severity: "CRITICAL",
        message: `${page.url.href} references script(s) from ${blockedOrigins.join(", ")}, but the page's Content-Security-Policy script-src doesn't allow ${blockedOrigins.length === 1 ? "that origin" : "those origins"} — browsers will silently block the script(s) from loading`,
      },
    ];
  },
};
