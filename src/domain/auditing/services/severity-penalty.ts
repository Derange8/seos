import type { AuditSeverity } from "@/domain/auditing/entities/audit-issue";

// Shared between AuditRun.finish() (the single combined score) and the
// scoring context's per-category breakdown (src/domain/scoring/) — both
// need the exact same severity weighting to stay consistent with each
// other.
export const SEVERITY_PENALTY: Record<AuditSeverity, number> = {
  CRITICAL: 10,
  WARNING: 4,
  INFO: 1,
};
