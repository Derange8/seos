import { useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PageDto } from "@/application/crawling/dto";
import type { WordPressConnectionDto } from "@/application/wordpress/dto";
import type { ProjectDto } from "@/application/projects/dto";
import type { GrowthAnalysisDto, PageContentDraftDto } from "@/application/content-enrichment/dto";
import type { AiVisibilityRunDto, AiVisibilityTrendPointDto, VisibilityExperimentDto, MultiEngineComparisonDto } from "@/application/ai-visibility/dto";
import { AiVisibilityTrendChart } from "@/components/ai-visibility-trend-chart";
import type { CitationDraft } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import { formatAiVisibilityReport } from "@/lib/format-ai-visibility-report";
import { formatFullGrowthReport } from "@/lib/format-full-growth-report";
import { PRIORITY_ORDER, PRIORITY_BADGE_VARIANT, PRIORITY_LABEL, VisibilityMetric, type TranslationKey } from "./shared";
import type { Language } from "@/hooks/use-language";

export interface GrowthTabProps {
  project: ProjectDto;
  wordPressConnection: WordPressConnectionDto | null;
  pages: PageDto[];
  t: (key: TranslationKey) => string;
  language: Language;

  // AI Visibility
  aiVisibility: AiVisibilityRunDto | null;
  aiVisibilityTrend: AiVisibilityTrendPointDto[];
  isProbingAiVisibility: boolean;
  engineComparison: MultiEngineComparisonDto | null;
  isComparingEngines: boolean;
  isSuggestingQueries: boolean;
  aiVisibilityError: string | null;
  aiVisibilityQueries: string;
  setAiVisibilityQueries: Dispatch<SetStateAction<string>>;
  aiVisibilityCompetitors: string;
  setAiVisibilityCompetitors: Dispatch<SetStateAction<string>>;
  aiVisibilityWebGrounded: boolean;
  setAiVisibilityWebGrounded: Dispatch<SetStateAction<boolean>>;
  diagnosingQuery: string | null;
  diagnoses: Record<string, string[]>;
  diagnoseErrors: Record<string, string>;
  isBuildingFixPlan: boolean;
  fixPlanError: string | null;
  draftingQuery: string | null;
  citationDrafts: Record<string, CitationDraft>;
  draftGapErrors: Record<string, string>;
  copiedDraftQuery: string | null;
  publishingCitationQuery: string | null;
  citationPublishErrors: Record<string, string>;
  citationPublishedQueries: Record<string, boolean>;
  experiments: VisibilityExperimentDto[];
  copiedAiVisibilityReport: boolean;
  setCopiedAiVisibilityReport: Dispatch<SetStateAction<boolean>>;
  handleBuildFixPlan: () => void;
  handleSuggestAiVisibilityQueries: () => void;
  handleRunAiVisibilityProbe: () => void;
  handleCompareEngines: () => void;
  handleDiagnoseGap: (query: string) => void;
  handleGenerateCitationDraft: (query: string) => void;
  handleCopyCitationDraft: (query: string) => void;
  handlePublishCitationDraft: (query: string) => void;
  engineLabel: (engine: string) => string;
  experimentOutcomeClass: (outcome: string | null) => string;

  // Growth Analysis
  growthAnalysis: GrowthAnalysisDto | null;
  isGeneratingGrowthAnalysis: boolean;
  growthAnalysisError: string | null;
  handleGenerateGrowthAnalysis: () => void;

  // Page Content Draft
  contentDrafts: PageContentDraftDto[];
  draftPageUrl: string;
  setDraftPageUrl: Dispatch<SetStateAction<string>>;
  generatingDraft: boolean;
  draftError: string | null;
  copiedDraftUrl: string | null;
  setCopiedDraftUrl: Dispatch<SetStateAction<string | null>>;
  draftActionPendingId: string | null;
  draftActionErrors: Record<string, string>;
  handleGenerateDraft: (pageUrl: string) => void;
  handlePublishDraft: (draftId: string) => void;
  handleRevertDraft: (draftId: string) => void;
  formatDraftForCopy: (draft: PageContentDraftDto) => string;
}

export function GrowthTab({
  project,
  wordPressConnection,
  pages,
  t,
  language,
  aiVisibility,
  aiVisibilityTrend,
  isProbingAiVisibility,
  engineComparison,
  isComparingEngines,
  isSuggestingQueries,
  aiVisibilityError,
  aiVisibilityQueries,
  setAiVisibilityQueries,
  aiVisibilityCompetitors,
  setAiVisibilityCompetitors,
  aiVisibilityWebGrounded,
  setAiVisibilityWebGrounded,
  diagnosingQuery,
  diagnoses,
  diagnoseErrors,
  isBuildingFixPlan,
  fixPlanError,
  draftingQuery,
  citationDrafts,
  draftGapErrors,
  copiedDraftQuery,
  publishingCitationQuery,
  citationPublishErrors,
  citationPublishedQueries,
  experiments,
  copiedAiVisibilityReport,
  setCopiedAiVisibilityReport,
  handleBuildFixPlan,
  handleSuggestAiVisibilityQueries,
  handleRunAiVisibilityProbe,
  handleCompareEngines,
  handleDiagnoseGap,
  handleGenerateCitationDraft,
  handleCopyCitationDraft,
  handlePublishCitationDraft,
  engineLabel,
  experimentOutcomeClass,
  growthAnalysis,
  isGeneratingGrowthAnalysis,
  growthAnalysisError,
  handleGenerateGrowthAnalysis,
  contentDrafts,
  draftPageUrl,
  setDraftPageUrl,
  generatingDraft,
  draftError,
  copiedDraftUrl,
  setCopiedDraftUrl,
  draftActionPendingId,
  draftActionErrors,
  handleGenerateDraft,
  handlePublishDraft,
  handleRevertDraft,
  formatDraftForCopy,
}: GrowthTabProps) {
  const [copiedEverything, setCopiedEverything] = useState(false);
  const hasAnyReportableContent = aiVisibility || growthAnalysis || contentDrafts.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {hasAnyReportableContent && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(
                formatFullGrowthReport(project.domain, {
                  aiVisibility,
                  aiVisibilityTrend,
                  experiments,
                  growthAnalysis,
                  contentDrafts,
                })
              );
              setCopiedEverything(true);
              setTimeout(() => setCopiedEverything(false), 1500);
            }}
          >
            {copiedEverything ? t("copied") : t("copyEverything")}
          </Button>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("cardAiVisibility")}</CardTitle>
          <CardAction className="flex gap-2">
            {aiVisibility &&
              aiVisibility.groundingMode === "web_grounded" &&
              aiVisibility.scorecard.winnableQueries.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBuildFixPlan}
                  disabled={isBuildingFixPlan || isProbingAiVisibility}
                >
                  {isBuildingFixPlan ? t("preparingFixPlan") : t("prepareFixPlan")}
                </Button>
              )}
            {aiVisibility && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    formatAiVisibilityReport(project.domain, aiVisibility, aiVisibilityTrend, experiments)
                  );
                  setCopiedAiVisibilityReport(true);
                  setTimeout(() => setCopiedAiVisibilityReport(false), 1500);
                }}
              >
                {copiedAiVisibilityReport ? t("copied") : t("copyReport")}
              </Button>
            )}
            <Button
              onClick={handleSuggestAiVisibilityQueries}
              disabled={isSuggestingQueries || isProbingAiVisibility}
              variant="outline"
              size="sm"
            >
              {isSuggestingQueries ? t("suggesting") : t("suggestQueries")}
            </Button>
            <Button onClick={handleRunAiVisibilityProbe} disabled={isProbingAiVisibility || isSuggestingQueries} size="sm">
              {isProbingAiVisibility ? t("measuring") : aiVisibility ? t("remeasure") : t("measure")}
            </Button>
            <Button
              onClick={handleCompareEngines}
              disabled={isComparingEngines || isProbingAiVisibility}
              variant="outline"
              size="sm"
              title={t("compareEnginesTooltip")}
            >
              {isComparingEngines ? t("comparing") : t("compareEngines")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            {t("aiVisibilityDescription")}
          </p>
          {fixPlanError && <p className="text-xs text-amber-300">{fixPlanError}</p>}
          {engineComparison && (
            <div className="glass-card flex flex-col gap-2 rounded-xl p-4">
              <p className="text-sm font-medium">{t("engineComparison")}</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[26rem] text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="pb-1 text-left font-medium">{t("engine")}</th>
                      <th className="pb-1 text-right font-medium text-green-400/90">{t("recommended")}</th>
                      <th className="pb-1 text-right font-medium text-cyan-300/90">{t("winnable")}</th>
                      <th className="pb-1 text-right font-medium">{t("contested")}</th>
                      <th className="pb-1 text-right font-medium text-amber-300/90">{t("cited")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engineComparison.engines.map((e) => (
                      <tr key={e.engine} className="border-t border-white/8">
                        <td className="py-1.5 font-medium">{engineLabel(e.engine)}</td>
                        <td className="py-1.5 text-right tabular-nums text-green-400">{e.mentionedPct}%</td>
                        <td className="py-1.5 text-right tabular-nums text-cyan-300">{e.openPct}%</td>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">{e.contestedPct}%</td>
                        <td className="py-1.5 text-right tabular-nums text-amber-300">{e.citedPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {engineComparison.failed.length > 0 && (
                <p className="text-xs text-destructive">
                  {t("couldntMeasure")} {engineComparison.failed.map((f) => engineLabel(f.engine)).join(", ")}
                </p>
              )}
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={aiVisibilityWebGrounded}
              onChange={(e) => setAiVisibilityWebGrounded(e.target.checked)}
              className="accent-primary"
            />
            {t("useLiveWebSearch")}
          </label>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ai-visibility-queries">{t("targetQueries")}</Label>
            <textarea
              id="ai-visibility-queries"
              value={aiVisibilityQueries}
              onChange={(e) => setAiVisibilityQueries(e.target.value)}
              rows={4}
              placeholder={"best prediction market platform\nTürkçe tahmin piyasası uygulaması"}
              className="w-full rounded-lg border border-input bg-transparent p-2.5 font-mono text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ai-visibility-competitors">{t("knownCompetitors")}</Label>
            <Input
              id="ai-visibility-competitors"
              value={aiVisibilityCompetitors}
              onChange={(e) => setAiVisibilityCompetitors(e.target.value)}
              placeholder={t("competitorPlaceholderExample")}
            />
          </div>
          {aiVisibilityError && <p className="text-red-400">{aiVisibilityError}</p>}
          {!aiVisibility && !aiVisibilityError && (
            <p className="text-muted-foreground">{t("noProbeRunYet")}</p>
          )}
          {aiVisibilityTrend.length >= 2 && (
            <div className="inset-panel rounded-md p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t("trendRuns")} ({aiVisibilityTrend.length} {t("runsLabel")})
              </p>
              <AiVisibilityTrendChart points={aiVisibilityTrend} />
            </div>
          )}
          {aiVisibility && (
            <div className="flex flex-col gap-3">
              {/* The core reading as a proper stat panel — big numbers with
                  the movement vs the previous run underneath, not an emoji
                  footnote. */}
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <VisibilityMetric
                  label={t("recommended")}
                  pct={aiVisibility.scorecard.mentionedPct}
                  tone="good"
                  delta={aiVisibility.delta ? aiVisibility.delta.mentionedPctDelta : null}
                  vsLastLabel={t("vsLast")}
                />
                <VisibilityMetric
                  label={t("winnableOpen")}
                  pct={aiVisibility.scorecard.openPct}
                  tone="open"
                  delta={aiVisibility.delta ? aiVisibility.delta.openPctDelta : null}
                  vsLastLabel={t("vsLast")}
                />
                <VisibilityMetric
                  label={t("contested")}
                  pct={aiVisibility.scorecard.contestedPct}
                  tone="muted"
                  delta={aiVisibility.delta ? aiVisibility.delta.contestedPctDelta : null}
                  vsLastLabel={t("vsLast")}
                />
                {aiVisibility.groundingMode === "web_grounded" && (
                  <VisibilityMetric
                    label={t("citedInSources")}
                    pct={aiVisibility.scorecard.citedPct}
                    tone="cited"
                    delta={aiVisibility.delta?.citedComparable ? aiVisibility.delta.citedPctDelta : null}
                    vsLastLabel={t("vsLast")}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground/70">
                {aiVisibility.scorecard.totalSamples} {t("samples")} · {engineLabel(aiVisibility.engine)} ·{" "}
                {aiVisibility.groundingMode === "web_grounded" ? t("liveWebSearch") : t("modelMemory")} ·{" "}
                {new Date(aiVisibility.runAt).toLocaleString()}
                {aiVisibility.delta && (
                  <> · {t("since")} {new Date(aiVisibility.delta.previousRunAt).toLocaleDateString()}</>
                )}
              </p>
              {aiVisibility.delta && aiVisibility.delta.changes.length > 0 && (
                <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  {aiVisibility.delta.changes.map((c) => (
                    <li key={c.query}>
                      <span className="text-foreground">{c.query}</span>: {c.from} → {c.to}
                    </li>
                  ))}
                </ul>
              )}
              {aiVisibility.scorecard.competitorFrequency.length > 0 && (
                <p className="text-muted-foreground">
                  {t("competitorsDominating")}{" "}
                  {aiVisibility.scorecard.competitorFrequency.map((c) => `${c.name} (${c.queryCount})`).join(", ")}
                </p>
              )}
              {aiVisibility.scorecard.winnableQueries.length > 0 && (
                <div>
                  <p className="text-cyan-300">{t("winnableQueriesNoIncumbent")}</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {aiVisibility.scorecard.winnableQueries.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                {aiVisibility.queries.map((q) => (
                  <div key={q.query} className="inset-panel flex flex-col gap-1.5 rounded-lg px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="truncate font-medium">{q.query}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{q.dominantSlot}</Badge>
                        <span className="text-xs tabular-nums text-muted-foreground" title={t("mentionedOpenContestedTooltip")}>
                          M{q.mentioned} · O{q.open} · C{q.contested}
                        </span>
                        {!q.confident && (
                          <span
                            className="text-xs text-yellow-500"
                            title={t("uncertainReadingTooltip").replace("{pct}", String(Math.round(q.consensus * 100)))}
                          >
                            ⚠ {t("uncertainBadge")}
                          </span>
                        )}
                        {q.citedSamples > 0 && (
                          <span className="text-xs text-amber-300" title={t("citedSamplesTooltip")}>
                            🔗 {q.citedSamples}
                          </span>
                        )}
                        {q.dominantSlot !== "MENTIONED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDiagnoseGap(q.query)}
                            disabled={diagnosingQuery === q.query}
                          >
                            {diagnosingQuery === q.query ? t("diagnosing") : t("whyNot")}
                          </Button>
                        )}
                      </span>
                    </div>
                    {q.citations.length > 0 && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer select-none">
                          {t("sourcesCited")} ({q.citations.length})
                        </summary>
                        <ul className="mt-1 flex flex-col gap-0.5 pl-2">
                          {q.citations.map((c) => (
                            <li key={c.url} className="truncate">
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-300 hover:underline"
                                title={c.url}
                              >
                                {c.title ?? c.url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {diagnoseErrors[q.query] && <p className="text-xs text-red-400">{diagnoseErrors[q.query]}</p>}
                    {diagnoses[q.query] && (
                      <ul className="list-disc pl-5 text-xs text-muted-foreground">
                        {diagnoses[q.query].map((gap, i) => (
                          <li key={i}>{gap}</li>
                        ))}
                      </ul>
                    )}
                    {diagnoses[q.query] && diagnoses[q.query].length > 0 && (
                      <div className="flex flex-col gap-2">
                        <div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateCitationDraft(q.query)}
                            disabled={draftingQuery === q.query}
                          >
                            {draftingQuery === q.query ? t("drafting") : t("draftContent")}
                          </Button>
                        </div>
                        {draftGapErrors[q.query] && <p className="text-xs text-red-400">{draftGapErrors[q.query]}</p>}
                        {citationDrafts[q.query] && (
                          <div className="flex flex-col gap-2 inset-panel rounded-md p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{citationDrafts[q.query].title}</span>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleCopyCitationDraft(q.query)}>
                                  {copiedDraftQuery === q.query ? t("copiedLabel") : t("copy")}
                                </Button>
                                {wordPressConnection && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePublishCitationDraft(q.query)}
                                    disabled={publishingCitationQuery === q.query || citationPublishedQueries[q.query]}
                                  >
                                    {citationPublishedQueries[q.query]
                                      ? t("draftCreatedInWordPress")
                                      : publishingCitationQuery === q.query
                                        ? t("publishing")
                                        : t("publish")}
                                  </Button>
                                )}
                              </div>
                            </div>
                            {!wordPressConnection && (
                              <p className="text-xs text-muted-foreground/70">
                                {t("connectWordPressToPushDraft")}
                              </p>
                            )}
                            {citationPublishErrors[q.query] && (
                              <p className="text-xs text-red-400">{citationPublishErrors[q.query]}</p>
                            )}
                            <p className="text-xs italic text-muted-foreground">
                              {citationDrafts[q.query].metaDescription}
                            </p>
                            {citationDrafts[q.query].sections.map((s, i) => (
                              <div key={i}>
                                <p className="font-medium">{s.heading}</p>
                                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{s.body}</p>
                              </div>
                            ))}
                            {citationDrafts[q.query].faqs.length > 0 && (
                              <div>
                                <p className="font-medium">{t("faq")}</p>
                                {citationDrafts[q.query].faqs.map((f, i) => (
                                  <div key={i} className="mt-1">
                                    <p className="text-xs font-medium">{f.question}</p>
                                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">{f.answer}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {experiments.length > 0 && (
            <div className="flex flex-col gap-1 inset-panel rounded-md p-3">
              <span className="font-medium">{t("experiments")}</span>
              <span className="text-xs text-muted-foreground">
                {t("experimentsDescription")}
              </span>
              {experiments.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-2 border-b border-white/5 py-1"
                >
                  <span className="truncate">{e.query}</span>
                  <span className="flex items-center gap-2 whitespace-nowrap text-xs">
                    <span className="text-muted-foreground">
                      {e.baselineSlot}
                      {e.outcomeSlot ? ` → ${e.outcomeSlot}` : ""}
                    </span>
                    {e.citationMovement === "GAINED" && (
                      <span className="text-amber-300" title={t("nowCitedInSourcesTooltip")}>
                        🔗 {t("citedBadge")}
                      </span>
                    )}
                    {e.status === "OPEN" ? (
                      <Badge variant="outline">{t("tracking")}</Badge>
                    ) : (
                      <Badge variant="outline" className={experimentOutcomeClass(e.outcome)}>
                        {e.outcome}
                      </Badge>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("growthAnalysisTitle")}</CardTitle>
          <CardAction>
            <Button onClick={handleGenerateGrowthAnalysis} disabled={isGeneratingGrowthAnalysis} size="sm">
              {isGeneratingGrowthAnalysis
                ? t("analyzing")
                : growthAnalysis
                  ? t("regenerate")
                  : t("generateGrowthAnalysis")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            {t("growthAnalysisDescription")}
          </p>
          {growthAnalysisError && <p className="text-red-400">{growthAnalysisError}</p>}
          {!growthAnalysis && !growthAnalysisError && (
            <p className="text-muted-foreground">{t("noAnalysisGeneratedYet")}</p>
          )}
        </CardContent>
      </Card>

      {growthAnalysis && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("businessUnderstanding")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{growthAnalysis.businessUnderstanding}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("contentCoverageGaps")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{growthAnalysis.contentGapsSummary}</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{t("highImpactOpportunities")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {[...growthAnalysis.opportunities]
                .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
                .map((opportunity, index) => (
                  <div key={index} className="inset-panel rounded-lg p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="font-medium">{opportunity.title}</span>
                      <Badge variant={PRIORITY_BADGE_VARIANT[opportunity.priority] ?? "secondary"}>
                        {PRIORITY_LABEL[opportunity.priority]?.[language] ?? opportunity.priority}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {opportunity.pageType} · {opportunity.suggestedSlug} · {t("intentLabel")}: {opportunity.searchIntent}
                    </p>
                    <p className="mt-1 text-xs">{opportunity.whyUsersSearch}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("revenueCase")} {opportunity.whyRevenue}</p>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{t("conversionOpportunities")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {growthAnalysis.conversionOpportunities.map((item, index) => (
                <div key={index} className="inset-panel rounded-lg p-2">
                  <p className="truncate text-xs text-muted-foreground" title={item.pageUrl}>
                    {item.pageUrl}
                  </p>
                  <p className="text-xs">{item.recommendation}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("competitorLikePagesMissing")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {growthAnalysis.missingCompetitorPages.map((item, index) => (
                  <li key={index}>• {item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("next10Pages")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-1 text-sm text-muted-foreground">
                {growthAnalysis.topPages.map((item, index) => (
                  <li key={index}>
                    {index + 1}. {item}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{t("executiveSummary")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{growthAnalysis.executiveSummary}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("pageContentDraftTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            {t("pageContentDraftDescription")}
          </p>
          {pages.length === 0 ? (
            <p className="text-muted-foreground">{t("runCrawlFromOverviewFirst")}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={draftPageUrl}
                onChange={(e) => setDraftPageUrl(e.target.value)}
                className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="">{t("selectAPage")}</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.url}>
                    {page.title ? `${page.title} — ${page.url}` : page.url}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => handleGenerateDraft(draftPageUrl)}
                disabled={generatingDraft || !draftPageUrl}
                size="sm"
              >
                {generatingDraft ? t("writingEllipsis") : t("generateDraft")}
              </Button>
            </div>
          )}
          {draftError && <p className="text-red-400">{draftError}</p>}
        </CardContent>
      </Card>

      {contentDrafts.map((draft) => (
        <Card key={draft.pageUrl}>
          <CardHeader>
            <CardTitle className="truncate" title={draft.pageUrl}>
              {t("draftPrefix")} · {draft.pageUrl}
              {draft.status === "PUBLISHED" && <span className="ml-2 text-green-400">{t("published")}</span>}
              {draft.status === "FAILED" && <span className="ml-2 text-red-400">{t("publishFailed")}</span>}
            </CardTitle>
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(formatDraftForCopy(draft));
                  setCopiedDraftUrl(draft.pageUrl);
                  setTimeout(() => setCopiedDraftUrl((u) => (u === draft.pageUrl ? null : u)), 1500);
                }}
              >
                {copiedDraftUrl === draft.pageUrl ? t("copied") : t("copy")}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="inset-panel rounded-lg p-2">
              <p className="text-xs text-muted-foreground">{t("title")}</p>
              <p>{draft.suggestedTitle}</p>
              <p className="mt-2 text-xs text-muted-foreground">{t("metaDescription")}</p>
              <p>{draft.suggestedMetaDescription}</p>
            </div>
            {!wordPressConnection && <p className="text-xs text-muted-foreground/70">{t("draftNeedsWordPress")}</p>}
            {draftActionErrors[draft.id] && <p className="text-xs text-red-400">{draftActionErrors[draft.id]}</p>}
            {wordPressConnection && (
              <div>
                {draft.status !== "PUBLISHED" ? (
                  <Button
                    size="sm"
                    disabled={draftActionPendingId === draft.id}
                    onClick={() => handlePublishDraft(draft.id)}
                  >
                    {draftActionPendingId === draft.id ? t("publishing") : t("publish")}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={draftActionPendingId === draft.id}
                    onClick={() => handleRevertDraft(draft.id)}
                  >
                    {draftActionPendingId === draft.id ? t("reverting") : t("revert")}
                  </Button>
                )}
              </div>
            )}
            {draft.bodySections.map((section, index) => (
              <div key={index}>
                <p className="font-medium">{section.heading}</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{section.content}</p>
              </div>
            ))}
            {draft.faqs.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="font-medium">{t("faq")}</p>
                {draft.faqs.map((faq, index) => (
                  <div key={index} className="inset-panel rounded-lg p-2">
                    <p className="text-xs font-medium">{faq.question}</p>
                    <p className="text-xs text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
