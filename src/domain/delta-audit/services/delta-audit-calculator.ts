import type { AuditIssue, AuditSeverity } from "@/domain/auditing/entities/audit-issue";

export type IssueChangeType = "RESOLVED" | "NEW" | "PERSISTING";

export interface IssueDelta {
  pageUrl: string;
  ruleId: string;
  changeType: IssueChangeType;
  severity: AuditSeverity;
  message: string;
}

export interface AuditDelta {
  previousRunId: string;
  currentRunId: string;
  previousScore: number | null;
  currentScore: number | null;
  scoreDelta: number | null;
  // The score is a per-page average penalty (see seo-score-calculator.ts),
  // so a crawl that goes deeper and finds more pages can leave the score
  // roughly flat even while the absolute issue count rises a lot — without
  // these, that looks like a bug ("184 issues now but the same score?")
  // rather than what it is: a bigger site, sampled more completely.
  previousPageCount: number;
  currentPageCount: number;
  resolvedCount: number;
  newCount: number;
  persistingCount: number;
  issues: readonly IssueDelta[];
}

export interface AuditRunSnapshot {
  runId: string;
  overallScore: number | null;
  pageCount: number;
  issues: readonly AuditIssue[];
}

// Pages get a fresh id every crawl (CrawlJob/Page rows are never reused),
// so an issue's pageId can never match across two AuditRuns even when
// it's "the same" problem on "the same" page. (pageUrl, ruleId) is the
// only identity that survives a re-crawl — the "issue fingerprint."
function fingerprint(pageUrl: string, ruleId: string): string {
  return `${pageUrl}::${ruleId}`;
}

interface Fingerprinted {
  issue: AuditIssue;
  pageUrl: string;
}

function buildFingerprintMap(
  issues: readonly AuditIssue[],
  pageUrlsByPageId: ReadonlyMap<string, string>
): Map<string, Fingerprinted> {
  const map = new Map<string, Fingerprinted>();
  for (const issue of issues) {
    const pageUrl = pageUrlsByPageId.get(issue.pageId);
    // A page whose url we can't resolve can't be fingerprinted reliably —
    // skipped rather than guessed, same "don't fabricate" stance the fix
    // generators take.
    if (!pageUrl) continue;
    map.set(fingerprint(pageUrl, issue.ruleId), { issue, pageUrl });
  }
  return map;
}

// VERIFY layer: did the fixes from the previous crawl actually work? This
// is the one piece of the READ/THINK/ACT/VERIFY loop that didn't exist
// before — everything upstream finds and proposes fixes, nothing closed
// the loop by checking whether they landed.
export function computeAuditDelta(
  previous: AuditRunSnapshot,
  current: AuditRunSnapshot,
  pageUrlsByPageId: ReadonlyMap<string, string>
): AuditDelta {
  const previousByFingerprint = buildFingerprintMap(previous.issues, pageUrlsByPageId);
  const currentByFingerprint = buildFingerprintMap(current.issues, pageUrlsByPageId);

  const issues: IssueDelta[] = [];

  for (const [key, { issue, pageUrl }] of previousByFingerprint) {
    if (!currentByFingerprint.has(key)) {
      issues.push({
        pageUrl,
        ruleId: issue.ruleId,
        changeType: "RESOLVED",
        severity: issue.severity,
        message: issue.message,
      });
    }
  }

  for (const [key, { issue, pageUrl }] of currentByFingerprint) {
    const changeType: IssueChangeType = previousByFingerprint.has(key) ? "PERSISTING" : "NEW";
    issues.push({ pageUrl, ruleId: issue.ruleId, changeType, severity: issue.severity, message: issue.message });
  }

  const scoreDelta =
    previous.overallScore !== null && current.overallScore !== null
      ? Math.round((current.overallScore - previous.overallScore) * 100) / 100
      : null;

  return {
    previousRunId: previous.runId,
    currentRunId: current.runId,
    previousScore: previous.overallScore,
    currentScore: current.overallScore,
    scoreDelta,
    previousPageCount: previous.pageCount,
    currentPageCount: current.pageCount,
    resolvedCount: issues.filter((issue) => issue.changeType === "RESOLVED").length,
    newCount: issues.filter((issue) => issue.changeType === "NEW").length,
    persistingCount: issues.filter((issue) => issue.changeType === "PERSISTING").length,
    issues,
  };
}
