import type { AuditCategory, AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { SEVERITY_PENALTY } from "@/domain/auditing/services/severity-penalty";
import { SeoScore } from "@/domain/scoring/entities/seo-score";

const ALL_CATEGORIES: readonly AuditCategory[] = ["technical", "content", "performance", "structured_data"];

// Same formula as AuditRun.finish(), just scoped to a subset of issues and
// a caller-supplied denominator: site-level scores normalize by page count
// (so the breakdown stays consistent with overallScore), page-level scores
// use a denominator of 1 (a single page's own penalty total, unsmoothed by
// the rest of the site).
function scoreFor(issues: readonly AuditIssue[], denominator: number): number {
  if (denominator <= 0) return 100;
  const totalPenalty = issues.reduce((sum, issue) => sum + SEVERITY_PENALTY[issue.severity], 0);
  const score = Math.max(0, 100 - totalPenalty / denominator);
  return Math.round(score * 100) / 100;
}

// One row per category at the site level, plus one row per (page,
// category) — always all 4 categories, even when a category has zero
// issues (and thus scores 100), so a consumer never has to special-case
// "missing row means 100".
export function calculateSeoScores(
  auditRunId: string,
  issues: readonly AuditIssue[],
  pageIds: readonly string[]
): SeoScore[] {
  const scores: SeoScore[] = [];

  for (const category of ALL_CATEGORIES) {
    const categoryIssues = issues.filter((issue) => issue.category === category);
    scores.push(SeoScore.create(auditRunId, null, category, scoreFor(categoryIssues, pageIds.length)));
  }

  for (const pageId of pageIds) {
    const pageIssues = issues.filter((issue) => issue.pageId === pageId);
    for (const category of ALL_CATEGORIES) {
      const categoryIssues = pageIssues.filter((issue) => issue.category === category);
      scores.push(SeoScore.create(auditRunId, pageId, category, scoreFor(categoryIssues, 1)));
    }
  }

  return scores;
}
