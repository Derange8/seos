import type { FixType } from "@/domain/fixes/entities/fix-candidate";
import type { AuditCategory } from "@/domain/auditing/entities/audit-issue";

// A static, deliberately coarse lookup — not a computed prediction. Seos
// never invents precision it can't back with real measurement (see
// traffic-impact-calculator.ts's identical stance on traffic/revenue
// numbers), so this reports the same kind of estimate any experienced SEO
// would give from memory ("a title swap is a minute of work, rewriting
// thin content is not"), not a per-issue calculation.
export type FixTimeEstimate = "ONE_MINUTE" | "FIVE_MINUTES" | "FIFTEEN_MINUTES_PLUS";

// Every FixType Seos can currently generate a ready-to-apply candidate
// for (see ApplyFixCandidateUseCase.SUPPORTED_FIX_TYPES and
// title-fix-generator.ts's siblings) is a one-field swap — approve and
// apply, no manual drafting.
const FIX_TYPE_ESTIMATE: Record<FixType, FixTimeEstimate> = {
  TITLE: "ONE_MINUTE",
  META_DESCRIPTION: "ONE_MINUTE",
  H1: "ONE_MINUTE",
  CANONICAL_URL: "ONE_MINUTE",
};

// When no FixCandidate exists yet, the issue needs a human to actually
// write something — how much, depends on the kind of problem. Content
// gaps (thin content, missing structured data) mean drafting new
// material; everything else is a smaller, more mechanical edit.
const CATEGORY_MANUAL_ESTIMATE: Record<AuditCategory, FixTimeEstimate> = {
  content: "FIFTEEN_MINUTES_PLUS",
  structured_data: "FIFTEEN_MINUTES_PLUS",
  technical: "FIVE_MINUTES",
  performance: "FIFTEEN_MINUTES_PLUS",
};

export function estimateFixTime(category: AuditCategory, fixType: FixType | null): FixTimeEstimate {
  if (fixType) return FIX_TYPE_ESTIMATE[fixType];
  return CATEGORY_MANUAL_ESTIMATE[category];
}
