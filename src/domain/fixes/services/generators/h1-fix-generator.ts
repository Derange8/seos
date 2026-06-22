import type { Page } from "@/domain/crawling/entities/page";
import type { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import type { FixGenerator } from "@/domain/fixes/services/fix-generator";
import { humanizeUrlSlug } from "@/domain/fixes/services/url-slug";

export const h1FixGenerator: FixGenerator = {
  ruleIds: ["missing-h1"],
  generate(page: Page, issue: AuditIssue): FixCandidate | null {
    // The page's own <title> usually describes the same topic an H1
    // should — falls back to the URL slug only if there's no title either.
    const content = (page.title && page.title.trim()) || humanizeUrlSlug(page.url.pathname);
    return FixCandidate.createRuleBased(issue.id, page.id, "H1", content);
  },
};
