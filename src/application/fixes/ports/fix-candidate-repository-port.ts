import type { FixCandidate } from "@/domain/fixes/entities/fix-candidate";

export interface FixCandidateRepositoryPort {
  saveMany(fixCandidates: readonly FixCandidate[]): Promise<void>;
  findAllByCrawlJobId(crawlJobId: string): Promise<FixCandidate[]>;
  findById(id: string): Promise<FixCandidate | null>;
  // Updates a single already-persisted candidate's status/previousValue
  // (ApplyFixCandidateUseCase/RevertFixCandidateUseCase) — separate from
  // saveMany, which is strictly for the bulk initial-generation insert.
  save(fixCandidate: FixCandidate): Promise<void>;
}
