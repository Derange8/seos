import type { Page } from "@/domain/crawling/entities/page";
import type { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import type { FixGenerator, FixGeneratorContext } from "@/domain/fixes/services/fix-generator";
import {
  META_DESCRIPTION_MAX_LENGTH,
  META_DESCRIPTION_MIN_LENGTH,
} from "@/domain/auditing/services/rules/meta-description-length-rule";
import type { KeywordOpportunity } from "@/domain/tracking/entities/keyword-opportunity";

function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim();
}

// Prefers real page content (contentExcerpt) over fabricating a
// description from nothing — only falls back to a generic templated line
// when there's truly no usable text (e.g. a near-empty or JS-only page
// that failed to render).
function baseDescription(page: Page): string {
  const excerpt = page.contentExcerpt?.trim();
  if (!excerpt) {
    const subject = page.h1 ?? page.title ?? "this page";
    return `Learn more about ${subject} on ${page.url.hostname}.`;
  }
  if (excerpt.length >= META_DESCRIPTION_MIN_LENGTH) return excerpt;
  // Real content, just short of the recommended minimum — pad rather than
  // discard it.
  return `${excerpt} Learn more on ${page.url.hostname}.`;
}

// Same reasoning as the title generator: a real query this page already
// gets impressions for (just not clicks/ranking) is worth leading with,
// since search engines weigh query-matching text in the snippet — but
// only if the description doesn't already cover it.
function withKeyword(description: string, opportunity: KeywordOpportunity | null): string {
  if (!opportunity) return description;
  if (description.toLowerCase().includes(opportunity.query.toLowerCase())) return description;
  return `${opportunity.query}: ${description}`;
}

export const metaDescriptionFixGenerator: FixGenerator = {
  ruleIds: ["missing-meta-description", "meta-description-length"],
  generate(page: Page, issue: AuditIssue, context?: FixGeneratorContext): FixCandidate | null {
    const content = truncateAtWordBoundary(
      withKeyword(baseDescription(page), context?.topKeywordOpportunity ?? null),
      META_DESCRIPTION_MAX_LENGTH
    );
    return FixCandidate.createRuleBased(issue.id, page.id, "META_DESCRIPTION", content);
  },
};
