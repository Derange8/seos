import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";
import { estimateTextWidth } from "@/domain/auditing/services/text-width-estimator";

// Exported so the fix engine (src/domain/fixes/) can target the same range
// when generating a replacement title — one source of truth.
export const TITLE_MIN_LENGTH = 30;
export const TITLE_MAX_LENGTH = 60;
const MIN_LENGTH = TITLE_MIN_LENGTH;
const MAX_LENGTH = TITLE_MAX_LENGTH;

// Fires independently of missing-title-rule — a page with no title at all
// is a different, more severe issue than one with a too-short/long title.
export const titleLengthRule: AuditRule = {
  id: "title-length",
  evaluate(page: Page): AuditFinding[] {
    const title = page.title?.trim();
    if (!title) return [];

    // Boundary check uses estimated rendered width (see
    // text-width-estimator.ts), not raw character count — a title can sit
    // outside the character range and still render fine, or vice versa.
    // The message still reports the real character count since that's
    // what a person looks at and edits.
    const width = estimateTextWidth(title);

    if (width < MIN_LENGTH) {
      return [
        {
          ruleId: "title-length",
          category: "content",
          severity: "WARNING",
          message: `${page.url.href} title is ${title.length} characters (estimated rendered width: ${width}, recommended: ${MIN_LENGTH}-${MAX_LENGTH})`,
        },
      ];
    }
    if (width > MAX_LENGTH) {
      return [
        {
          ruleId: "title-length",
          category: "content",
          severity: "WARNING",
          message: `${page.url.href} title is ${title.length} characters (estimated rendered width: ${width}) and may be truncated in search results (recommended: ${MIN_LENGTH}-${MAX_LENGTH})`,
        },
      ];
    }
    return [];
  },
};
