import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// WARNING — per Google's hreflang spec, a missing return tag doesn't just
// weaken this one annotation, it makes Google discard the ENTIRE hreflang
// cluster for both pages involved. A page's own markup can look perfectly
// valid in isolation while still silently failing for this reason, which
// is exactly why this needs the cross-page check
// (DetectHreflangReciprocityUseCase) rather than a plain per-page rule.
export const hreflangMissingReturnTagRule: AuditRule = {
  id: "hreflang-missing-return-tag",
  isHtmlOnly: true,
  evaluate(page: Page): AuditFinding[] {
    if (page.hreflangMissingReturnTags.length === 0) return [];

    const targets = page.hreflangMissingReturnTags.map((link) => `${link.url} (${link.hreflang})`).join(", ");
    return [
      {
        ruleId: "hreflang-missing-return-tag",
        category: "technical",
        severity: "WARNING",
        message: `${page.url.href} has hreflang link(s) with no matching return tag on the target page — Google ignores the entire hreflang cluster until this is fixed: ${targets}`,
      },
    ];
  },
};
