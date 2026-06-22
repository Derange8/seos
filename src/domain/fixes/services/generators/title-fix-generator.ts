import type { Page } from "@/domain/crawling/entities/page";
import type { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import type { FixGenerator } from "@/domain/fixes/services/fix-generator";
import { humanizeUrlSlug } from "@/domain/fixes/services/url-slug";
import { TITLE_MAX_LENGTH, TITLE_MIN_LENGTH } from "@/domain/auditing/services/rules/title-length-rule";

function baseCandidate(page: Page): string {
  if (page.h1 && page.h1.trim().length > 0) return page.h1.trim();
  return humanizeUrlSlug(page.url.pathname);
}

// Targets the exact same range title-length-rule checks for, so a
// generated title doesn't just replace one issue with another.
function fitToRange(text: string, hostname: string): string {
  if (text.length > TITLE_MAX_LENGTH) {
    const truncated = text.slice(0, TITLE_MAX_LENGTH);
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > TITLE_MIN_LENGTH ? truncated.slice(0, lastSpace) : truncated).trim();
  }
  if (text.length < TITLE_MIN_LENGTH) {
    const padded = `${text} | ${hostname}`;
    return padded.length <= TITLE_MAX_LENGTH ? padded : text;
  }
  return text;
}

export const titleFixGenerator: FixGenerator = {
  ruleIds: ["missing-title", "title-length"],
  generate(page: Page, issue: AuditIssue): FixCandidate | null {
    const content = fitToRange(baseCandidate(page), page.url.hostname);
    return FixCandidate.createRuleBased(issue.id, page.id, "TITLE", content);
  },
};
