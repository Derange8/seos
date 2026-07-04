import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import type { AuditFinding } from "@/domain/auditing/entities/audit-issue";
import type { Page } from "@/domain/crawling/entities/page";

// Distinct from thin-content: thin-content means the page genuinely has
// little content everywhere. This means a browser sees plenty of content
// but it only exists after client-side JS runs (Page.isClientSideOnlyContent,
// computed in ProcessPageTaskUseCase from CrawlConfig.deepCsrCheck) — a
// crawler that doesn't execute JS (or Googlebot under indexing budget
// pressure) may see something close to nothing. "Add more text" doesn't
// fix this; server/static rendering the content does. Only fires when
// deepCsrCheck actually measured it (isClientSideOnlyContent defaults to
// false otherwise, same as every other measured-flag rule in this directory).
export const clientSideOnlyContentRule: AuditRule = {
  id: "client-side-only-content",
  evaluate(page: Page): AuditFinding[] {
    if (!page.isClientSideOnlyContent) return [];
    return [
      {
        ruleId: "client-side-only-content",
        category: "technical",
        severity: "WARNING",
        message: `${page.url.href} renders almost no content in the raw HTML (${page.rawWordCount} words) but ${page.wordCount} words once JavaScript runs — a crawler that doesn't execute JS may index this page as empty. Consider server-side or static rendering.`,
      },
    ];
  },
};
