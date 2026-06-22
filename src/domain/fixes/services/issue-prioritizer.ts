import type { AuditIssue, AuditSeverity } from "@/domain/auditing/entities/audit-issue";
import type { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import { SEVERITY_PENALTY } from "@/domain/auditing/services/severity-penalty";

// "Quick win" / "manual review" etc. — the four cells of a classic
// impact x ease matrix. Ease here is never guessed: it's exactly "does
// this issue already have a ready-to-use FixCandidate" (the ACT layer
// already decided which issues are template-fixable vs. need a human).
export type PriorityTier = "QUICK_WIN" | "MANUAL_REVIEW" | "FILL_IN" | "LOW_PRIORITY";

export interface IssuePriority {
  issueId: string;
  tier: PriorityTier;
  impactScore: number;
  hasReadyFix: boolean;
}

const TIER_RANK: Record<PriorityTier, number> = {
  QUICK_WIN: 0,
  MANUAL_REVIEW: 1,
  FILL_IN: 2,
  LOW_PRIORITY: 3,
};

function isHighImpact(severity: AuditSeverity): boolean {
  return severity === "CRITICAL" || severity === "WARNING";
}

function classifyTier(severity: AuditSeverity, hasReadyFix: boolean): PriorityTier {
  if (isHighImpact(severity)) return hasReadyFix ? "QUICK_WIN" : "MANUAL_REVIEW";
  return hasReadyFix ? "FILL_IN" : "LOW_PRIORITY";
}

// THINK layer: ranks issues by impact x ease so the user knows what to
// act on first. Sorted QUICK_WIN -> MANUAL_REVIEW -> FILL_IN ->
// LOW_PRIORITY, breaking ties within a tier by impact score (so a
// CRITICAL quick win still sorts ahead of a WARNING quick win).
export function prioritizeIssues(
  issues: readonly AuditIssue[],
  fixCandidates: readonly FixCandidate[]
): readonly IssuePriority[] {
  const issuesWithFix = new Set(fixCandidates.map((candidate) => candidate.auditIssueId));

  const priorities = issues.map((issue) => {
    const hasReadyFix = issuesWithFix.has(issue.id);
    return {
      issueId: issue.id,
      tier: classifyTier(issue.severity, hasReadyFix),
      impactScore: SEVERITY_PENALTY[issue.severity],
      hasReadyFix,
    };
  });

  return priorities.sort(
    (a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.impactScore - a.impactScore
  );
}
