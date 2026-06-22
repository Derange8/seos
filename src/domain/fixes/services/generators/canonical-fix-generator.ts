import type { Page } from "@/domain/crawling/entities/page";
import type { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import type { FixGenerator } from "@/domain/fixes/services/fix-generator";

export const canonicalFixGenerator: FixGenerator = {
  ruleIds: ["missing-canonical"],
  generate(page: Page, issue: AuditIssue): FixCandidate | null {
    // The standard default when no canonical is set and there's no known
    // duplicate elsewhere: canonicalize the page to itself.
    return FixCandidate.createRuleBased(issue.id, page.id, "CANONICAL_URL", page.url.href);
  },
};
