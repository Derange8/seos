import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SitemapFileDto } from "@/application/sitemap/dto";
import type { LlmsTxtFileDto } from "@/application/llms-txt/dto";
import type { RobotsFileDto } from "@/application/robots/dto";
import type { SchemaMarkupDto } from "@/application/schema-markup/dto";
import { SOURCE_LABEL, type TranslationKey } from "./shared";
import type { Language } from "@/hooks/use-language";

export interface OutputsTabProps {
  t: (key: TranslationKey) => string;
  language: Language;
  robots: RobotsFileDto | null;
  showRobotsTxt: boolean;
  setShowRobotsTxt: Dispatch<SetStateAction<boolean>>;
  schemaMarkup: SchemaMarkupDto[];
  expandedSchemaId: string | null;
  setExpandedSchemaId: Dispatch<SetStateAction<string | null>>;
  sitemap: SitemapFileDto | null;
  showSitemapXml: boolean;
  setShowSitemapXml: Dispatch<SetStateAction<boolean>>;
  llmsTxt: LlmsTxtFileDto | null;
  showLlmsTxt: boolean;
  setShowLlmsTxt: Dispatch<SetStateAction<boolean>>;
}

// Small filetype glyphs for the code-panel top bar — purely decorative, kept
// tiny and monochrome (currentColor) so they inherit muted-foreground and
// never fight the content for attention.
function RobotsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="size-3.5">
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      <circle cx="9" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <path d="M9 17h6" />
    </svg>
  );
}

function SchemaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="size-3.5">
      <path d="M8 3H6a1 1 0 0 0-1 1v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a1 1 0 0 0 1 1h2" />
      <path d="M16 3h2a1 1 0 0 1 1 1v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a1 1 0 0 1-1 1h-2" />
    </svg>
  );
}

function SitemapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="size-3.5">
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M12 16V11M5 8v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
    </svg>
  );
}

function LlmsTxtIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="size-3.5">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 16.5h6" />
    </svg>
  );
}

// A code/data preview with a filename top bar — reused for robots.txt,
// sitemap.xml, and expanded JSON-LD blocks so the "this is generated output
// you can inspect" framing stays consistent across every output type.
// `nested`: the schema-markup card already wraps each entry in an
// `.inset-panel` — stacking a second one here would double the tint, so it
// falls back to a flat `bg-black/20` surface instead in that context.
function CodePanel({ filename, content, nested }: { filename: string; content: string; nested?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-xl ${nested ? "border border-white/10 bg-black/20" : "inset-panel"}`}>
      <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-3 py-1.5">
        <span className="font-mono text-[0.7rem] text-muted-foreground">{filename}</span>
      </div>
      <pre className="max-h-80 overflow-auto p-3 font-mono text-xs leading-relaxed text-foreground/90">{content}</pre>
    </div>
  );
}

export function OutputsTab({
  t,
  language,
  robots,
  showRobotsTxt,
  setShowRobotsTxt,
  schemaMarkup,
  expandedSchemaId,
  setExpandedSchemaId,
  sitemap,
  showSitemapXml,
  setShowSitemapXml,
  llmsTxt,
  showLlmsTxt,
  setShowLlmsTxt,
}: OutputsTabProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {robots && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RobotsIcon />
              {t("cardRobots")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-xs text-muted-foreground">{t("generated")} {new Date(robots.generatedAt).toLocaleString()}</p>
            <Button variant="outline" size="sm" className="self-start" onClick={() => setShowRobotsTxt((v) => !v)}>
              {showRobotsTxt ? t("hideRobotsTxt") : t("viewRobotsTxt")}
            </Button>
            {showRobotsTxt && <CodePanel filename="robots.txt" content={robots.content} />}
          </CardContent>
        </Card>
      )}

      {schemaMarkup.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SchemaIcon />
              {t("cardSchema")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-xs text-muted-foreground">
              {schemaMarkup.length} {t("jsonLdBlocksGenerated")}
            </p>
            <div className="flex flex-col gap-2">
              {schemaMarkup.map((markup) => (
                <div key={markup.id} className="inset-panel flex flex-col gap-2 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{markup.type}</p>
                      <p className="text-xs text-muted-foreground">{SOURCE_LABEL[markup.source]?.[language] ?? markup.source}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedSchemaId((id) => (id === markup.id ? null : markup.id))}
                    >
                      {expandedSchemaId === markup.id ? t("hideJsonLd") : t("viewJsonLd")}
                    </Button>
                  </div>
                  {expandedSchemaId === markup.id && (
                    <CodePanel
                      filename={`${markup.type}.jsonld`}
                      content={JSON.stringify(markup.jsonLd, null, 2)}
                      nested
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {sitemap && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SitemapIcon />
              {t("cardSitemap")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">{sitemap.pageCount}</span> {t("urlsLabel")}
              {" · "}
              {t("generated")} {new Date(sitemap.generatedAt).toLocaleString()}
            </p>
            <Button variant="outline" size="sm" className="self-start" onClick={() => setShowSitemapXml((v) => !v)}>
              {showSitemapXml ? t("hideSitemapXml") : t("viewSitemapXml")}
            </Button>
            {showSitemapXml && <CodePanel filename="sitemap.xml" content={sitemap.content} />}
          </CardContent>
        </Card>
      )}

      {llmsTxt && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LlmsTxtIcon />
              {t("cardLlmsTxt")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">{llmsTxt.pageCount}</span> {t("pagesListedLabel")}
              {" · "}
              {t("generated")} {new Date(llmsTxt.generatedAt).toLocaleString()}
            </p>
            <Button variant="outline" size="sm" className="self-start" onClick={() => setShowLlmsTxt((v) => !v)}>
              {showLlmsTxt ? t("hideLlmsTxt") : t("viewLlmsTxt")}
            </Button>
            {showLlmsTxt && <CodePanel filename="llms.txt" content={llmsTxt.content} />}
          </CardContent>
        </Card>
      )}

      {!robots && !sitemap && schemaMarkup.length === 0 && !llmsTxt && (
        <Card className="md:col-span-2">
          <CardContent className="pt-5 text-sm text-muted-foreground">
            {t("nothingGeneratedYet")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
