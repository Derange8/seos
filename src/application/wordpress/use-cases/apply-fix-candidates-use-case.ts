import { ApplyFixCandidateUseCase, type ApplyFixCandidateDeps } from "@/application/wordpress/use-cases/apply-fix-candidate-use-case";

export interface BulkApplyFixResult {
  fixCandidateId: string;
  status: "applied" | "failed";
  error?: string;
  errorCode?: string;
}

// "Fix All" for one rule/route-template group — a thin loop over the
// existing single-fix use case (ApplyFixCandidateDeps is identical, no new
// repos/clients needed), not a new code path. Applies are attempted
// sequentially, not in parallel: candidates can point at the same
// WordPress post (e.g. two fixes on one page) or share the connection's
// rate limits, and one candidate's outcome should never race another's.
// A failure never aborts the batch — a page whose WordPress post was
// deleted shouldn't block every other page's otherwise-valid fix from
// applying, so every candidate is always attempted and reported
// individually.
export class ApplyFixCandidatesUseCase {
  private readonly single: ApplyFixCandidateUseCase;

  constructor(deps: ApplyFixCandidateDeps) {
    this.single = new ApplyFixCandidateUseCase(deps);
  }

  async execute(projectId: string, fixCandidateIds: readonly string[]): Promise<BulkApplyFixResult[]> {
    const results: BulkApplyFixResult[] = [];
    for (const fixCandidateId of fixCandidateIds) {
      const result = await this.single.execute(projectId, fixCandidateId);
      results.push(
        result.ok
          ? { fixCandidateId, status: "applied" }
          : { fixCandidateId, status: "failed", error: result.error.message, errorCode: result.error.code }
      );
    }
    return results;
  }
}
