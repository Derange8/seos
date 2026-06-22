import type { Page } from "@/domain/crawling/entities/page";
import type { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import type { FixCandidate } from "@/domain/fixes/entities/fix-candidate";

export interface FixGenerator {
  // Which audit rule id(s) this generator addresses — e.g. title-length and
  // missing-title both produce a TITLE fix from the same generator.
  readonly ruleIds: readonly string[];
  // May return null if there's truly nothing to generate from — generators
  // below always have at least a URL-derived fallback, but the contract
  // allows a future generator to decline rather than fabricate.
  generate(page: Page, issue: AuditIssue): FixCandidate | null;
}
