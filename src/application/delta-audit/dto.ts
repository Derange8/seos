import type { AuditDelta } from "@/domain/delta-audit/services/delta-audit-calculator";

export interface IssueDeltaDto {
  pageUrl: string;
  ruleId: string;
  changeType: string;
  severity: string;
  message: string;
}

export interface AuditDeltaDto {
  previousRunId: string;
  currentRunId: string;
  previousScore: number | null;
  currentScore: number | null;
  scoreDelta: number | null;
  previousPageCount: number;
  currentPageCount: number;
  resolvedCount: number;
  newCount: number;
  persistingCount: number;
  issues: IssueDeltaDto[];
}

export function toAuditDeltaDto(delta: AuditDelta): AuditDeltaDto {
  return {
    previousRunId: delta.previousRunId,
    currentRunId: delta.currentRunId,
    previousScore: delta.previousScore,
    currentScore: delta.currentScore,
    scoreDelta: delta.scoreDelta,
    previousPageCount: delta.previousPageCount,
    currentPageCount: delta.currentPageCount,
    resolvedCount: delta.resolvedCount,
    newCount: delta.newCount,
    persistingCount: delta.persistingCount,
    issues: delta.issues.map((issue) => ({
      pageUrl: issue.pageUrl,
      ruleId: issue.ruleId,
      changeType: issue.changeType,
      severity: issue.severity,
      message: issue.message,
    })),
  };
}
