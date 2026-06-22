import type { FixCandidateRepositoryPort } from "@/application/fixes/ports/fix-candidate-repository-port";
import type { FixCandidate } from "@/domain/fixes/entities/fix-candidate";

export class FakeFixCandidateRepository implements FixCandidateRepositoryPort {
  readonly saved: FixCandidate[] = [];

  async saveMany(fixCandidates: readonly FixCandidate[]): Promise<void> {
    this.saved.push(...fixCandidates);
  }

  async findAllByCrawlJobId(): Promise<FixCandidate[]> {
    // No test currently needs this to be crawlJobId-aware (mirrors
    // FakeSeoScoreRepository's same simplification) — every test deals
    // with one crawl job at a time.
    return [...this.saved];
  }

  async findById(id: string): Promise<FixCandidate | null> {
    return this.saved.find((candidate) => candidate.id === id) ?? null;
  }

  async save(fixCandidate: FixCandidate): Promise<void> {
    const index = this.saved.findIndex((candidate) => candidate.id === fixCandidate.id);
    if (index === -1) {
      this.saved.push(fixCandidate);
    } else {
      this.saved[index] = fixCandidate;
    }
  }
}
