import type { AuditRunRepositoryPort } from "@/application/auditing/ports/audit-run-repository-port";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";
import { ApplyFixCandidateUseCase, type ApplyFixCandidateDeps } from "@/application/wordpress/use-cases/apply-fix-candidate-use-case";
import type { FixType } from "@/domain/fixes/entities/fix-candidate";
import type { Logger } from "@/shared/logger";

// Mirrors ApplyFixCandidateUseCase's own SUPPORTED_FIX_TYPES — Otomatik
// Pilot never auto-applies anything a human clicking "Approve & Apply"
// couldn't already apply with equal confidence. H1/CANONICAL_URL stay
// manual-only regardless of this feature.
const AUTO_APPLIABLE_TYPES: readonly FixType[] = ["TITLE", "META_DESCRIPTION"];

export interface AutoApplyApprovedFixesDeps extends ApplyFixCandidateDeps {
  auditRunRepository: AuditRunRepositoryPort;
  projectRepository: ProjectRepositoryPort;
}

// Only reachable from AuditRunCompleted, registered after
// GenerateFixCandidatesUseCase's own handler — runs once per finished
// audit, after that run's FixCandidates already exist. Per-candidate
// try/catch (not just per-project, like the Google scheduler) since one
// bad WordPress response must not stop the rest of an otherwise-healthy
// auto-apply pass — ApplyFixCandidateUseCase already marks a failed
// candidate FAILED rather than leaving it stuck silently.
export class AutoApplyApprovedFixesUseCase {
  constructor(
    private readonly deps: AutoApplyApprovedFixesDeps,
    private readonly logger: Logger
  ) {}

  async execute(auditRunId: string): Promise<void> {
    const auditRun = await this.deps.auditRunRepository.findById(auditRunId);
    if (!auditRun) {
      throw new Error(`AuditRun "${auditRunId}" not found while auto-applying fixes`);
    }

    const project = await this.deps.projectRepository.findById(auditRun.projectId);
    if (!project || !project.autoPilotEnabled) return;

    const connection = await this.deps.wordPressConnectionRepository.findByProjectId(auditRun.projectId);
    if (!connection) return;

    const candidates = await this.deps.fixCandidateRepository.findAllByCrawlJobId(auditRun.crawlJobId);
    const eligible = candidates.filter(
      (candidate) => candidate.status === "DRAFT" && AUTO_APPLIABLE_TYPES.includes(candidate.type)
    );
    if (eligible.length === 0) return;

    const applyFixCandidate = new ApplyFixCandidateUseCase(this.deps);

    for (const candidate of eligible) {
      const result = await applyFixCandidate.execute(auditRun.projectId, candidate.id);
      if (!result.ok) {
        this.logger.error("Otomatik Pilot: auto-apply failed for a fix candidate", {
          projectId: auditRun.projectId,
          fixCandidateId: candidate.id,
          error: result.error.message,
        });
      }
    }
  }
}
