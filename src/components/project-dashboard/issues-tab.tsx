import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditIssueDto, AuditRunDto } from "@/application/auditing/dto";
import type { AuditSeverity } from "@/domain/auditing/entities/audit-issue";
import type { FixCandidateDto } from "@/application/fixes/dto";
import type { WordPressConnectionDto } from "@/application/wordpress/dto";
import type { ProjectDto } from "@/application/projects/dto";
import { formatAuditReport } from "@/lib/format-audit-report";
import { IssueRow, SEVERITY_BADGE_VARIANT, type TranslationKey } from "./shared";
import type { Language } from "@/hooks/use-language";

export type SeverityFilter = "ALL" | AuditSeverity;

const SEVERITY_FILTERS: SeverityFilter[] = ["ALL", "CRITICAL", "WARNING", "INFO"];

const SEVERITY_FILTER_LABEL_KEY: Record<SeverityFilter, TranslationKey> = {
  ALL: "filterAll",
  CRITICAL: "filterCritical",
  WARNING: "filterWarning",
  INFO: "filterInfo",
};

export function countBySeverity(issues: AuditIssueDto[]): Record<AuditSeverity, number> {
  const counts: Record<AuditSeverity, number> = { CRITICAL: 0, WARNING: 0, INFO: 0 };
  for (const issue of issues) counts[issue.severity]++;
  return counts;
}

// Filters a rule/template group tree down to one severity without losing
// the grouping structure — a group whose issues are now all filtered out
// disappears entirely rather than rendering an empty disclosure.
export function filterIssueGroups(groups: IssueGroup[], filter: SeverityFilter): IssueGroup[] {
  if (filter === "ALL") return groups;
  return groups
    .map((group) => {
      const issues = group.issues.filter((issue) => issue.severity === filter);
      const templateGroups = group.templateGroups
        .map((tg) => ({ ...tg, issues: tg.issues.filter((issue) => issue.severity === filter) }))
        .filter((tg) => tg.issues.length > 1);
      const templatedIssueIds = new Set(templateGroups.flatMap((tg) => tg.issues.map((i) => i.id)));
      const ungroupedIssues = issues.filter((issue) => !templatedIssueIds.has(issue.id));
      return { ...group, issues, templateGroups, ungroupedIssues };
    })
    .filter((group) => group.issues.length > 0);
}

export interface IssueTemplateGroup {
  routeTemplate: string;
  issues: AuditIssueDto[];
}

export interface IssueGroup {
  ruleId: string;
  issues: AuditIssueDto[];
  templateGroups: IssueTemplateGroup[];
  ungroupedIssues: AuditIssueDto[];
}

export interface IssuesTabProps {
  project: ProjectDto;
  auditRun: AuditRunDto | null;
  fixCandidates: FixCandidateDto[];
  issueGroups: IssueGroup[];
  expandedRuleIds: Set<string>;
  toggleRuleExpanded: (ruleId: string) => void;
  wordPressConnection: WordPressConnectionDto | null;
  fixActionErrors: Record<string, string>;
  copiedFixId: string | null;
  fixActionPendingId: string | null;
  copiedFullReport: boolean;
  setCopiedFullReport: Dispatch<SetStateAction<boolean>>;
  setCopiedFixId: Dispatch<SetStateAction<string | null>>;
  handleApplyFix: (fixId: string) => void;
  handleRevertFix: (fixId: string) => void;
  fixAllPendingKey: string | null;
  fixAllErrors: Record<string, string>;
  handleApplyFixAll: (groupKey: string, fixCandidateIds: string[]) => void;
  t: (key: TranslationKey) => string;
  language: Language;
}

// TITLE/META_DESCRIPTION are the only fix types ApplyFixCandidateUseCase
// can push to WordPress (see its SUPPORTED_FIX_TYPES) — same restriction
// IssueRow's own per-issue Approve & Apply button already applies.
const BULK_APPLICABLE_FIX_TYPES = new Set(["TITLE", "META_DESCRIPTION"]);

// Ready-to-apply candidate ids for one group of issues — only fixes that
// are (a) a supported type, (b) not already applied, and (c) actually
// exist (an issue can lack a fix candidate entirely, e.g. no rule-based
// generator for it yet).
function readyFixIdsForIssues(issues: AuditIssueDto[], fixCandidates: FixCandidateDto[]): string[] {
  const byIssueId = new Map(fixCandidates.map((candidate) => [candidate.auditIssueId, candidate]));
  return issues
    .map((issue) => byIssueId.get(issue.id))
    .filter(
      (fix): fix is FixCandidateDto =>
        fix !== undefined && fix.status !== "APPLIED" && BULK_APPLICABLE_FIX_TYPES.has(fix.type)
    )
    .map((fix) => fix.id);
}

// The most severe issue in a group drives the accent color on its disclosure
// button — a cluster of 40 CRITICAL issues should read as urgent at a glance,
// not the same flat gray as a cluster of INFO nits.
function dominantSeverity(issues: AuditIssueDto[]): string {
  if (issues.some((issue) => issue.severity === "CRITICAL")) return "CRITICAL";
  if (issues.some((issue) => issue.severity === "WARNING")) return "WARNING";
  return issues[0]?.severity ?? "INFO";
}

function FixAllButton({
  groupKey,
  readyFixIds,
  fixAllPendingKey,
  fixAllErrors,
  handleApplyFixAll,
  t,
}: {
  groupKey: string;
  readyFixIds: string[];
  fixAllPendingKey: string | null;
  fixAllErrors: Record<string, string>;
  handleApplyFixAll: (groupKey: string, fixCandidateIds: string[]) => void;
  t: (key: TranslationKey) => string;
}) {
  if (readyFixIds.length < 2) return null;
  const isPending = fixAllPendingKey === groupKey;
  return (
    <span className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={(event) => {
          event.stopPropagation();
          handleApplyFixAll(groupKey, readyFixIds);
        }}
      >
        {isPending ? t("fixingAllEllipsis") : t("fixAllCount").replace("{count}", String(readyFixIds.length))}
      </Button>
      {fixAllErrors[groupKey] && <span className="text-xs text-red-400">{fixAllErrors[groupKey]}</span>}
    </span>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
    >
      <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IssuesTab({
  project,
  auditRun,
  fixCandidates,
  issueGroups,
  expandedRuleIds,
  toggleRuleExpanded,
  wordPressConnection,
  fixActionErrors,
  copiedFixId,
  fixActionPendingId,
  copiedFullReport,
  setCopiedFullReport,
  setCopiedFixId,
  handleApplyFix,
  handleRevertFix,
  fixAllPendingKey,
  fixAllErrors,
  handleApplyFixAll,
  t,
  language,
}: IssuesTabProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const severityCounts = useMemo(() => countBySeverity(auditRun?.issues ?? []), [auditRun]);
  const filteredIssueGroups = useMemo(
    () => filterIssueGroups(issueGroups, severityFilter),
    [issueGroups, severityFilter]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("cardAudit")}</CardTitle>
        {auditRun && auditRun.issues.length > 0 && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(formatAuditReport(project.domain, auditRun, fixCandidates));
                setCopiedFullReport(true);
                setTimeout(() => setCopiedFullReport(false), 1500);
              }}
            >
              {copiedFullReport ? t("copied") : t("copyFullReport")}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {auditRun ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
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

            {auditRun.issues.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {SEVERITY_FILTERS.map((filter) => {
                  const count = filter === "ALL" ? auditRun.issues.length : severityCounts[filter];
                  const isActive = severityFilter === filter;
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setSeverityFilter(filter)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        isActive
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                      }`}
                    >
                      {t(SEVERITY_FILTER_LABEL_KEY[filter])} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {auditRun.issues.length > 0 && filteredIssueGroups.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("noIssuesMatchFilter")}</p>
            )}

            {auditRun.issues.length > 0 && (
              <div className="flex flex-col gap-3">
                {filteredIssueGroups.map((group) => {
                  const isCluster = group.issues.length > 1;
                  const isExpanded = !isCluster || expandedRuleIds.has(group.ruleId);
                  const severity = dominantSeverity(group.issues);
                  const groupReadyFixIds = readyFixIdsForIssues(group.issues, fixCandidates);
                  return (
                    <div key={group.ruleId} className="flex flex-col gap-2">
                      {isCluster && (
                        <button
                          type="button"
                          onClick={() => toggleRuleExpanded(group.ruleId)}
                          aria-expanded={isExpanded}
                          className="glass-card flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <ChevronIcon expanded={isExpanded} />
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold tabular-nums text-primary">
                              {group.issues.length}
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium text-foreground">{group.ruleId}</span>
                                <Badge variant={SEVERITY_BADGE_VARIANT[severity] ?? "default"}>{severity}</Badge>
                              </span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {t("pagesAffectedBySameIssue")}
                              </span>
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            {group.templateGroups.length === 0 && (
                              <FixAllButton
                                groupKey={group.ruleId}
                                readyFixIds={groupReadyFixIds}
                                fixAllPendingKey={fixAllPendingKey}
                                fixAllErrors={fixAllErrors}
                                handleApplyFixAll={handleApplyFixAll}
                                t={t}
                              />
                            )}
                            <span className="text-xs font-medium text-muted-foreground">
                              {isExpanded ? t("hidePages") : t("showPages")}
                            </span>
                          </span>
                        </button>
                      )}
                      {isExpanded && group.templateGroups.length > 0 && (
                        <div className="flex flex-col gap-2 pl-4">
                          {group.templateGroups.map((templateGroup) => {
                            const templateKey = `${group.ruleId}::${templateGroup.routeTemplate}`;
                            const isTemplateExpanded = expandedRuleIds.has(templateKey);
                            const templateReadyFixIds = readyFixIdsForIssues(templateGroup.issues, fixCandidates);
                            return (
                              <div key={templateKey} className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleRuleExpanded(templateKey)}
                                  aria-expanded={isTemplateExpanded}
                                  className="inset-panel flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-left transition-colors hover:bg-white/10"
                                >
                                  <span className="flex min-w-0 items-center gap-2.5">
                                    <ChevronIcon expanded={isTemplateExpanded} />
                                    <span className="min-w-0 text-xs text-muted-foreground">
                                      <span className="font-mono text-foreground">{templateGroup.routeTemplate}</span>
                                      {" — "}
                                      {templateGroup.issues.length} {t("pagesMatchTemplate")}{" "}
                                      {templateGroup.issues
                                        .slice(0, 2)
                                        .map((issue) => issue.pageUrl)
                                        .filter(Boolean)
                                        .join(", ")}
                                      {templateGroup.issues.length > 2 ? ", …" : ""}
                                      {t("fixingTemplateFixesAll")}
                                    </span>
                                  </span>
                                  <span className="flex shrink-0 items-center gap-3">
                                    <FixAllButton
                                      groupKey={templateKey}
                                      readyFixIds={templateReadyFixIds}
                                      fixAllPendingKey={fixAllPendingKey}
                                      fixAllErrors={fixAllErrors}
                                      handleApplyFixAll={handleApplyFixAll}
                                      t={t}
                                    />
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {isTemplateExpanded ? t("hidePages") : t("showPages")}
                                    </span>
                                  </span>
                                </button>
                                {isTemplateExpanded && (
                                  <div className="flex flex-col gap-1">
                                    {templateGroup.issues.map((issue) => (
                                      <IssueRow
                                        key={issue.id}
                                        issue={issue}
                                        fix={fixCandidates.find((candidate) => candidate.auditIssueId === issue.id)}
                                        wordPressConnection={wordPressConnection}
                                        fixActionErrors={fixActionErrors}
                                        copiedFixId={copiedFixId}
                                        fixActionPendingId={fixActionPendingId}
                                        onCopyFix={(fixId, content) => {
                                          void navigator.clipboard.writeText(content);
                                          setCopiedFixId(fixId);
                                          setTimeout(() => setCopiedFixId((id) => (id === fixId ? null : id)), 1500);
                                        }}
                                        onApplyFix={handleApplyFix}
                                        onRevertFix={handleRevertFix}
                                        t={t}
                                        language={language}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {isExpanded && group.ungroupedIssues.length > 0 && (
                        <div className="flex flex-col gap-1">
                          {group.ungroupedIssues.map((issue) => (
                            <IssueRow
                              key={issue.id}
                              issue={issue}
                              fix={fixCandidates.find((candidate) => candidate.auditIssueId === issue.id)}
                              wordPressConnection={wordPressConnection}
                              fixActionErrors={fixActionErrors}
                              copiedFixId={copiedFixId}
                              fixActionPendingId={fixActionPendingId}
                              onCopyFix={(fixId, content) => {
                                void navigator.clipboard.writeText(content);
                                setCopiedFixId(fixId);
                                setTimeout(() => setCopiedFixId((id) => (id === fixId ? null : id)), 1500);
                              }}
                              onApplyFix={handleApplyFix}
                              onRevertFix={handleRevertFix}
                              t={t}
                              language={language}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">{t("noAuditYet")}</p>
        )}
      </CardContent>
    </Card>
  );
}
