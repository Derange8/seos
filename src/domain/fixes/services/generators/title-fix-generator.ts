import type { Page } from "@/domain/crawling/entities/page";
import type { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import type { FixGenerator, FixGeneratorContext } from "@/domain/fixes/services/fix-generator";
import { humanizeUrlSlug } from "@/domain/fixes/services/url-slug";
import { TITLE_MAX_LENGTH, TITLE_MIN_LENGTH } from "@/domain/auditing/services/rules/title-length-rule";
import type { KeywordOpportunity } from "@/domain/tracking/entities/keyword-opportunity";

function capitalizeWords(text: string): string {
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

// Without a real GSC signal, the best honest guess is still the page's own
// H1/URL — but when this page is already getting real search impressions
// for a specific query (just not ranking well for it), leading with that
// query is a far more targeted suggestion than a generic template, which
// is the gap a purely rule-based generator couldn't close before.
function baseCandidate(page: Page, opportunity: KeywordOpportunity | null): string {
  const subject = page.h1 && page.h1.trim().length > 0 ? page.h1.trim() : humanizeUrlSlug(page.url.pathname);
  if (!opportunity) return subject;

  const keyword = capitalizeWords(opportunity.query);
  // Already covers the keyword (e.g. the H1 already says it) — don't
  // restate it redundantly.
  if (subject.toLowerCase().includes(opportunity.query.toLowerCase())) return subject;
  return `${keyword} — ${subject}`;
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
  generate(page: Page, issue: AuditIssue, context?: FixGeneratorContext): FixCandidate | null {
    const content = fitToRange(baseCandidate(page, context?.topKeywordOpportunity ?? null), page.url.hostname);
    return FixCandidate.createRuleBased(issue.id, page.id, "TITLE", content);
  },
};
