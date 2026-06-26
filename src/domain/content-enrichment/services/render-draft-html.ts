import type { PageContentDraft } from "@/domain/content-enrichment/entities/page-content-draft";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Renders a draft's structured body + FAQ into the HTML WordPress's
// post_content field expects. Plain h2/p/h3 — no styling assumptions about
// the live theme. Escapes everything: this text can ultimately originate
// from an LLM reasoning over untrusted crawled page content (see
// llm-json.ts's own prompt-injection hardening note), so it must never be
// trusted as pre-sanitized HTML.
export function renderDraftContentHtml(draft: PageContentDraft): string {
  const sections = draft.bodySections
    .map((section) => `<h2>${escapeHtml(section.heading)}</h2>\n<p>${escapeHtml(section.content)}</p>`)
    .join("\n\n");

  if (draft.faqs.length === 0) return sections;

  const faqHtml = draft.faqs
    .map((faq) => `<h3>${escapeHtml(faq.question)}</h3>\n<p>${escapeHtml(faq.answer)}</p>`)
    .join("\n\n");

  return [sections, "<h2>FAQ</h2>", faqHtml].filter(Boolean).join("\n\n");
}
