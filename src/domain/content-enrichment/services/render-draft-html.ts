import type { PageContentDraft } from "@/domain/content-enrichment/entities/page-content-draft";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Structural shape both PageContentDraft.bodySections (heading/content) and
// AiVisibilityModelPort's CitationDraft.sections (heading/body) can satisfy
// via a small adapter at each call site — kept as one rendering function
// rather than duplicated per draft type, since the HTML output (and its
// escaping requirement) is identical either way.
interface RenderableSection {
  heading: string;
  body: string;
}

interface RenderableFaq {
  question: string;
  answer: string;
}

// Renders a draft's structured body + FAQ into the HTML WordPress's
// post_content field expects. Plain h2/p/h3 — no styling assumptions about
// the live theme. Escapes everything: this text can ultimately originate
// from an LLM reasoning over untrusted crawled page content (see
// llm-json.ts's own prompt-injection hardening note), so it must never be
// trusted as pre-sanitized HTML.
export function renderDraftHtml(sections: readonly RenderableSection[], faqs: readonly RenderableFaq[]): string {
  const sectionsHtml = sections
    .map((section) => `<h2>${escapeHtml(section.heading)}</h2>\n<p>${escapeHtml(section.body)}</p>`)
    .join("\n\n");

  if (faqs.length === 0) return sectionsHtml;

  const faqHtml = faqs
    .map((faq) => `<h3>${escapeHtml(faq.question)}</h3>\n<p>${escapeHtml(faq.answer)}</p>`)
    .join("\n\n");

  return [sectionsHtml, "<h2>FAQ</h2>", faqHtml].filter(Boolean).join("\n\n");
}

export function renderDraftContentHtml(draft: PageContentDraft): string {
  return renderDraftHtml(
    draft.bodySections.map((section) => ({ heading: section.heading, body: section.content })),
    draft.faqs
  );
}
