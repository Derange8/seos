import { DomainError } from "@/shared/domain-error";

// Shared between ApplyFixCandidateUseCase and RevertFixCandidateUseCase —
// both need "no such fix candidate" / "project has no WordPress
// connection" as the same concepts, not two independently-evolving ones.
export class FixCandidateNotFoundError extends DomainError {
  readonly code = "FIX_CANDIDATE_NOT_FOUND";
}

export class WordPressNotConnectedError extends DomainError {
  readonly code = "WORDPRESS_NOT_CONNECTED";
}
