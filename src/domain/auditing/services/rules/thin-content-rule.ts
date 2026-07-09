import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

const MIN_WORD_COUNT = 300;

export const thinContentRule: AuditRule = {
  id: "thin-content",
  isHtmlOnly: true,
  evaluate(page: Page): AuditFinding[] {
    if (page.wordCount === null || page.wordCount >= MIN_WORD_COUNT) return [];
    return [
      {
        ruleId: "thin-content",
        category: "content",
        severity: "WARNING",
        message: `${page.url.href} has thin content (${page.wordCount} words, recommended: ${MIN_WORD_COUNT}+)`,
      },
    ];
  },
};
