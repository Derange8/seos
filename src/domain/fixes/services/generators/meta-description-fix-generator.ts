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

// The page's own <meta name="description"> is the source of truth when
// it exists (e.g. meta-description-length firing because it's too short/
// long) — editing what's actually there beats replacing it with scraped
// body text the tag never contained. Only missing-meta-description (where
// this is null) falls through to contentExcerpt, and only truly empty
// pages fall through further to a generic templated line.
function baseDescription(page: Page): string {
  const existing = page.metaDescription?.trim();
  if (existing) {
    if (existing.length >= META_DESCRIPTION_MIN_LENGTH) return existing;
    // Real, on-page description, just short of the recommended minimum —
    // pad rather than discard it.
    return `${existing} Learn more on ${page.url.hostname}.`;
  }

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
