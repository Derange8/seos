import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CrawlJobDto, PageDto } from "@/application/crawling/dto";
import type { AuditRunDto } from "@/application/auditing/dto";
import type { SeoScoreDto } from "@/application/scoring/dto";
import type { FixCandidateDto } from "@/application/fixes/dto";
import type { AuditDeltaDto } from "@/application/delta-audit/dto";
import type { ContentIdeaDto } from "@/application/content-enrichment/dto";
import type { AiVisibilityRunDto } from "@/application/ai-visibility/dto";
import { CATEGORY_LABEL, POLLABLE_STATUSES, StatTile, type TabId, type TranslationKey } from "./shared";

export interface OverviewTabProps {
  auditRun: AuditRunDto | null;
  aiVisibility: AiVisibilityRunDto | null;
  fixCandidates: FixCandidateDto[];
  crawlJob: CrawlJobDto | null;
  pages: PageDto[];
  isStartingCrawl: boolean;
  crawlError: string | null;
  scores: SeoScoreDto[];
  delta: AuditDeltaDto | null;
  contentIdeas: ContentIdeaDto[];
  isGeneratingContentIdeas: boolean;
  contentIdeasError: string | null;
  copiedContentIdeaId: string | null;
  t: (key: TranslationKey) => string;
  handleStartCrawl: () => void;
  handleGenerateContentIdeas: () => void;
  setActiveTab: (tab: TabId) => void;
  setCopiedContentIdeaId: Dispatch<SetStateAction<string | null>>;
}

// Small status pill for the crawl lifecycle — replaces the old plain-text
// "Status: RUNNING" line with something that reads at a glance the way a
// build/deploy status chip does in Vercel/Linear.
function CrawlStatusPill({ status, t }: { status: string; t: (key: TranslationKey) => string }) {
  const isActive = POLLABLE_STATUSES.has(status);
  const isFailed = status === "FAILED";
  const isDone = status === "COMPLETED" || status === "DONE";
  const label =
    status === "PENDING"
      ? t("crawlStatusPending")
      : status === "RUNNING"
        ? t("crawlStatusRunning")
        : isFailed
          ? t("crawlStatusFailed")
          : isDone
            ? t("crawlStatusCompleted")
            : status;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isActive
          ? "bg-primary/15 text-primary"
          : isFailed
            ? "bg-destructive/15 text-destructive"
            : isDone
              ? "bg-success/15 text-success"
              : "bg-white/10 text-muted-foreground"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          isActive
            ? "animate-pulse bg-primary"
            : isFailed
              ? "bg-destructive"
              : isDone
                ? "bg-success"
                : "bg-muted-foreground"
        }`}
      />
      {label}
    </span>
  );
}

export function OverviewTab({
  auditRun,
  aiVisibility,
  fixCandidates,
  crawlJob,
  pages,
  isStartingCrawl,
  crawlError,
  scores,
  delta,
  contentIdeas,
  isGeneratingContentIdeas,
  contentIdeasError,
  copiedContentIdeaId,
  t,
  handleStartCrawl,
  handleGenerateContentIdeas,
  setActiveTab,
  setCopiedContentIdeaId,
}: OverviewTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Status-at-a-glance: the product's real value (SEO health + AI
          visibility) surfaced on the first screen, not buried in a tab. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t("seoHealth")}
          value={auditRun?.overallScore != null ? `${auditRun.overallScore}` : "—"}
          suffix={auditRun?.overallScore != null ? "/100" : undefined}
          hint={
            auditRun
              ? `${auditRun.issues.length} ${auditRun.issues.length === 1 ? t("issueCountLabel") : t("issueCountLabelPlural")}`
              : t("runACrawl")
          }
        />
        <StatTile
          label={t("aiVisibility")}
          value={aiVisibility ? `${aiVisibility.scorecard.mentionedPct}` : "—"}
          suffix={aiVisibility ? "%" : undefined}
          hint={aiVisibility ? t("recommendedByAi") : t("notMeasuredYet")}
          accent
        />
        <StatTile
          label={t("citedInSources")}
          value={aiVisibility && aiVisibility.groundingMode === "web_grounded" ? `${aiVisibility.scorecard.citedPct}` : "—"}
          suffix={aiVisibility && aiVisibility.groundingMode === "web_grounded" ? "%" : undefined}
          hint={aiVisibility ? t("inAiSearchAnswers") : t("measureWithWebSearch")}
        />
        <StatTile
          label={t("pendingFixes")}
          value={`${fixCandidates.length}`}
          hint={fixCandidates.length > 0 ? t("readyToApply") : t("nothingPending")}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("cardCrawl")}</CardTitle>
            {crawlJob && (
              <CardAction>
                <CrawlStatusPill status={crawlJob.status} t={t} />
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button
              onClick={handleStartCrawl}
              disabled={isStartingCrawl || (crawlJob ? POLLABLE_STATUSES.has(crawlJob.status) : false)}
              className="self-start"
            >
              {isStartingCrawl
                ? t("starting")
                : crawlJob && POLLABLE_STATUSES.has(crawlJob.status)
                  ? t("crawling")
                  : t("startCrawl")}
            </Button>
            {crawlError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{crawlError}</p>
            )}

            {crawlJob && (
              <div className="inset-panel flex items-center justify-between rounded-xl px-4 py-3">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("pagesCrawled")}</span>
                <span className="text-lg font-semibold tabular-nums text-foreground">{crawlJob.pageCount}</span>
              </div>
            )}
            {crawlJob?.error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{crawlJob.error}</p>
            )}

            {pages.length > 0 && (
              <div className="inset-panel flex max-h-72 flex-col gap-1 overflow-y-auto rounded-xl p-2">
                {pages.map((page) => (
                  <div
                    key={page.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{page.title ?? t("noTitle")}</p>
                      <p className="truncate text-xs text-muted-foreground">{page.url}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {page.statusCode ?? "—"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {auditRun && (
          <Card>
            <CardHeader>
              <CardTitle>{t("cardAuditScore")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("score")}</span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-semibold tracking-tight tabular-nums text-foreground">
                      {auditRun.overallScore}
                    </span>
                    <span className="text-base text-muted-foreground">/100</span>
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {auditRun.issues.length} {auditRun.issues.length === 1 ? t("issueCountLabel") : t("issueCountLabelPlural")}
                </span>
              </div>
              {scores.length > 0 && (
                <div className="inset-panel grid grid-cols-2 gap-2 rounded-xl p-3 sm:grid-cols-4">
                  {scores.map((score) => (
                    <div key={score.category} className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">
                        {CATEGORY_LABEL[score.category] ?? score.category}
                      </span>
                      <span className="text-lg font-semibold tabular-nums text-foreground">{score.score}</span>
                    </div>
                  ))}
                </div>
              )}
              {auditRun.issues.length > 0 && (
                <Button variant="outline" size="sm" className="self-start" onClick={() => setActiveTab("issues")}>
                  {t("viewIssuesAndFixes")}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {delta && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{t("cardTrend")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums text-muted-foreground">
                    {delta.previousScore}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-4xl font-semibold tracking-tight tabular-nums text-foreground">
                    {delta.currentScore}
                  </span>
                  {delta.scoreDelta !== null && (
                    <span
                      className={`ml-1 text-sm font-medium ${delta.scoreDelta >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {delta.scoreDelta >= 0 ? "+" : ""}
                      {delta.scoreDelta}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{delta.resolvedCount} {t("resolved")}</Badge>
                  <Badge variant="destructive">{delta.newCount} {t("newLabel")}</Badge>
                  <Badge variant="outline">{delta.persistingCount} {t("unchanged")}</Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {delta.previousPageCount} → {delta.currentPageCount} {t("pagesCrawledArrow")}
                {delta.currentPageCount !== delta.previousPageCount && (
                  <>
                    {" — "}
                    {t("scorePerPageNote")}
                  </>
                )}
              </p>
              {delta.issues.filter((issue) => issue.changeType !== "PERSISTING").length > 0 && (
                <div className="inset-panel flex flex-col gap-1 rounded-xl p-2">
                  {delta.issues
                    .filter((issue) => issue.changeType !== "PERSISTING")
                    .map((issue, index) => (
                      <div
                        key={`${issue.pageUrl}-${issue.ruleId}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-white/5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-foreground">{issue.message}</p>
                          <p className="truncate text-xs text-muted-foreground">{issue.ruleId}</p>
                        </div>
                        <Badge variant={issue.changeType === "RESOLVED" ? "default" : "destructive"} className="shrink-0">
                          {issue.changeType === "RESOLVED" ? t("fixed") : t("newLabel")}
                        </Badge>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(pages.length > 0 || contentIdeas.length > 0) && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>{t("contentIdeasTitle")}</CardTitle>
              <CardAction>
                <Button onClick={handleGenerateContentIdeas} disabled={isGeneratingContentIdeas} size="sm">
                  {isGeneratingContentIdeas
                    ? t("generatingEllipsis")
                    : contentIdeas.length > 0
                      ? t("regenerate")
                      : t("generateContentIdeas")}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{t("contentIdeasDescription")}</p>
              {contentIdeasError && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{contentIdeasError}</p>
              )}
              {contentIdeas.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {contentIdeas.map((idea) => (
                    <div key={idea.id} className="inset-panel flex flex-col gap-2 rounded-xl p-4">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <span className="text-sm font-medium text-foreground">{idea.suggestedTitle}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {idea.suggestedSlug}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground" title={idea.sourcePageUrl}>
                        {t("fromLabel")}: {idea.sourcePageUrl}
                      </p>
                      <p className="text-xs text-muted-foreground">{idea.rationale}</p>
                      <Button
                        className="mt-1 self-start"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard.writeText(
                            `${idea.suggestedTitle}\n${idea.suggestedSlug}\n\n${idea.rationale}`
                          );
                          setCopiedContentIdeaId(idea.id);
                          setTimeout(() => setCopiedContentIdeaId((id) => (id === idea.id ? null : id)), 1500);
                        }}
                      >
                        {copiedContentIdeaId === idea.id ? t("copied") : t("copy")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
