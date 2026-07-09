import type { PageContentDraftDto } from "@/application/content-enrichment/dto";

// Plain-text export of a single page content draft — title, meta
// description, body sections, and FAQ — meant to be pasted into a doc, a
// CMS, or an LLM in one shot. Mirrors formatAuditReport/
// formatAiVisibilityReport: a pure function over the DTO the dashboard
// already holds, no fetch, no side effects.
export function formatDraftForCopy(draft: PageContentDraftDto): string {
  const sections = draft.bodySections.map((s) => `## ${s.heading}\n${s.content}`).join("\n\n");
  const faqs = draft.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
  return [
    `Title: ${draft.suggestedTitle}`,
    `Meta description: ${draft.suggestedMetaDescription}`,
    "",
    sections,
    "",
    "FAQ",
    faqs,
  ].join("\n");
}
