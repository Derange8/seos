import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding, AuditSeverity } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// A page with a lot of internal links pointing at it is one real visitors
// and crawlers actually reach through normal site navigation (a nav/footer
// link, or many in-content references) — its 404 is a real, high-traffic
// break. Below this, a couple of stray links (an old blog post referencing
// a removed page) is worth flagging but isn't "the whole site is broken."
const HIGH_INBOUND_LINK_THRESHOLD = 5;

function statusCodeSeverity(page: Page): AuditSeverity {
  // 410 Gone is the one status code a site owner can set deliberately to
  // say "this is gone on purpose, stop looking for it" — treating it the
  // same as an accidental 404 would punish sites for using the *correct*
  // way to retire a page. See detect-orphan-pages-use-case.ts for how
  // inboundInternalLinkCount is computed.
  if (page.statusCode === 410) return "INFO";
  // A URL the site owner still lists in their own sitemap.xml is a URL
  // they're actively telling search engines to visit — that's a stronger,
  // more deliberate signal than an incidental internal link (which could
  // be a stale reference nobody's gotten around to cleaning up), so it
  // overrides the link-count tiering below rather than just adding to it.
  // See audit-robots-and-sitemap-use-case.ts for how isInSitemap is set;
  // null (sitemap unreachable/invalid this run) falls through to the
  // link-count-only tiering, same as if it were never checked.
  if (page.isInSitemap === true) return "CRITICAL";
  if (page.inboundInternalLinkCount >= HIGH_INBOUND_LINK_THRESHOLD) return "CRITICAL";
  if (page.inboundInternalLinkCount > 0) return "WARNING";
  return "INFO";
}

export const brokenStatusCodeRule: AuditRule = {
  id: "broken-status-code",
  appliesToFailedPages: true,
  appliesToNoindexPages: true,
  evaluate(page: Page): AuditFinding[] {
    if (!page.isBroken()) return [];
    const severity = statusCodeSeverity(page);
    const reasons: string[] = [];
    if (page.isInSitemap === true) reasons.push("still listed in the site's sitemap.xml");
    if (page.inboundInternalLinkCount > 0) {
      reasons.push(`linked from ${page.inboundInternalLinkCount} page(s) on this site`);
    } else if (page.isInSitemap !== true) {
      reasons.push("no internal links point to it; may be a deliberately removed page nobody references anymore");
    }
    const suffix = reasons.length > 0 ? ` — ${reasons.join("; ")}` : "";
    return [
      {
        ruleId: "broken-status-code",
        category: "technical",
        severity,
        message: `${page.url.href} returned HTTP ${page.statusCode}${suffix}`,
      },
    ];
  },
};
