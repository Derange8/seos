import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";
import { estimateTextWidth } from "@/domain/auditing/services/text-width-estimator";

// Exported so the fix engine (src/domain/fixes/) can target the same range
// when generating a replacement description — one source of truth.
export const META_DESCRIPTION_MIN_LENGTH = 70;
export const META_DESCRIPTION_MAX_LENGTH = 160;
const MIN_LENGTH = META_DESCRIPTION_MIN_LENGTH;
const MAX_LENGTH = META_DESCRIPTION_MAX_LENGTH;

export const metaDescriptionLengthRule: AuditRule = {
  id: "meta-description-length",
  evaluate(page: Page): AuditFinding[] {
    const description = page.metaDescription?.trim();
    if (!description) return [];

    // Estimated rendered width, not raw character count — see
    // text-width-estimator.ts and title-length-rule's identical reasoning.
    const width = estimateTextWidth(description);

    if (width < MIN_LENGTH || width > MAX_LENGTH) {
      return [
        {
          ruleId: "meta-description-length",
          category: "content",
          severity: "INFO",
          message: `${page.url.href} meta description is ${description.length} characters (estimated rendered width: ${width}, recommended: ${MIN_LENGTH}-${MAX_LENGTH})`,
        },
      ];
    }
    return [];
  },
};
