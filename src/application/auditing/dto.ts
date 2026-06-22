import type { AuditRun } from "@/domain/auditing/entities/audit-run";
import type { AuditCategory, AuditSeverity } from "@/domain/auditing/entities/audit-issue";
import type { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import { prioritizeIssues, type PriorityTier } from "@/domain/fixes/services/issue-prioritizer";
import { calculateTrafficImpact, type TrafficImpactTier } from "@/domain/fixes/services/traffic-impact-calculator";
import type { PagePerformance } from "@/domain/tracking/entities/page-performance";

export interface AuditIssuePriorityDto {
  tier: PriorityTier;
  impactScore: number;
  hasReadyFix: boolean;
}

export interface AuditIssueTrafficImpactDto {
  tier: TrafficImpactTier;
  pageImpressions: number;
  pageClicks: number;
  hasTrafficData: boolean;
}

export interface AuditIssueDto {
  id: string;
  pageId: string;
  ruleId: string;
  category: AuditCategory;
  severity: AuditSeverity;
  message: string;
  recommendation: string | null;
  priority: AuditIssuePriorityDto;
  trafficImpact: AuditIssueTrafficImpactDto;
}

export interface AuditRunDto {
  id: string;
  projectId: string;
  crawlJobId: string;
  overallScore: number | null;
  isFinished: boolean;
  startedAt: string;
  finishedAt: string | null;
  issues: AuditIssueDto[];
}

// fixCandidates defaults to empty so every issue still gets a priority
// (everything classifies as MANUAL_REVIEW/LOW_PRIORITY with hasReadyFix:
// false) even before the fix engine has run — callers that have fix
// candidates available should always pass them for an accurate ranking.
// pageUrlsByPageId/pagePerformance default to empty similarly: every
// issue still gets a trafficImpact (tier ranked by severity alone,
// hasTrafficData: false) before/without a Google connection.
export function toAuditRunDto(
  auditRun: AuditRun,
  fixCandidates: readonly FixCandidate[] = [],
  pageUrlsByPageId: ReadonlyMap<string, string> = new Map(),
  pagePerformance: readonly PagePerformance[] = []
): AuditRunDto {
  const priorities = prioritizeIssues(auditRun.issues, fixCandidates);
  const priorityByIssueId = new Map(priorities.map((priority) => [priority.issueId, priority]));
  const trafficImpacts = calculateTrafficImpact(auditRun.issues, pageUrlsByPageId, pagePerformance);
  const trafficImpactByIssueId = new Map(trafficImpacts.map((impact) => [impact.issueId, impact]));
  // prioritizeIssues already returns issues ranked best-to-act-on-first —
  // sort the audit issues themselves into that same order so the API
  // (and the dashboard reading it) doesn't have to re-derive it.
  const issueRank = new Map(priorities.map((priority, index) => [priority.issueId, index]));
  const sortedIssues = [...auditRun.issues].sort(
    (a, b) => (issueRank.get(a.id) ?? 0) - (issueRank.get(b.id) ?? 0)
  );

  return {
    id: auditRun.id,
    projectId: auditRun.projectId,
    crawlJobId: auditRun.crawlJobId,
    overallScore: auditRun.overallScore,
    isFinished: auditRun.isFinished,
    startedAt: auditRun.startedAt.toISOString(),
    finishedAt: auditRun.finishedAt?.toISOString() ?? null,
    issues: sortedIssues.map((issue) => {
      const priority = priorityByIssueId.get(issue.id);
      const trafficImpact = trafficImpactByIssueId.get(issue.id);
      return {
        id: issue.id,
        pageId: issue.pageId,
        ruleId: issue.ruleId,
        category: issue.category,
        severity: issue.severity,
        message: issue.message,
        recommendation: issue.recommendation,
        priority: {
          tier: priority?.tier ?? "LOW_PRIORITY",
          impactScore: priority?.impactScore ?? 0,
          hasReadyFix: priority?.hasReadyFix ?? false,
        },
        trafficImpact: {
          tier: trafficImpact?.tier ?? "P4",
          pageImpressions: trafficImpact?.pageImpressions ?? 0,
          pageClicks: trafficImpact?.pageClicks ?? 0,
          hasTrafficData: trafficImpact?.hasTrafficData ?? false,
        },
      };
    }),
  };
}
