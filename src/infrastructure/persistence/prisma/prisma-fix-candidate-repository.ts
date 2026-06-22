import type { PrismaClient, FixCandidate as PrismaFixCandidateRow } from "@/generated/prisma/client";
import type { FixCandidateRepositoryPort } from "@/application/fixes/ports/fix-candidate-repository-port";
import { FixCandidate, type FixSource, type FixStatus, type FixType } from "@/domain/fixes/entities/fix-candidate";
import { sqliteWriteLock } from "@/shared/async-mutex";

function toDomain(row: PrismaFixCandidateRow): FixCandidate {
  return FixCandidate.reconstitute({
    id: row.id,
    auditIssueId: row.auditIssueId,
    pageId: row.pageId,
    type: row.type as FixType,
    content: row.content,
    source: row.source as FixSource,
    status: row.status as FixStatus,
    previousValue: row.previousValue,
    createdAt: row.createdAt,
  });
}

export class PrismaFixCandidateRepository implements FixCandidateRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  // Plain inserts, no upsert — every AuditIssue row belongs to exactly one
  // audit run (fresh per crawl), so FixCandidate rows are already
  // naturally scoped per crawl job through their auditIssueId and never
  // need replacing.
  async saveMany(fixCandidates: readonly FixCandidate[]): Promise<void> {
    if (fixCandidates.length === 0) return;

    // Runs from the AuditRunCompleted handler chain, close on the heels of
    // concurrent page saves finishing up — see AsyncMutex's doc comment.
    await sqliteWriteLock.runExclusive(() =>
      this.client.fixCandidate.createMany({
        data: fixCandidates.map((candidate) => ({
          id: candidate.id,
          auditIssueId: candidate.auditIssueId,
          pageId: candidate.pageId,
          type: candidate.type,
          content: candidate.content,
          source: candidate.source,
          status: candidate.status,
          createdAt: candidate.createdAt,
        })),
      })
    );
  }

  async findAllByCrawlJobId(crawlJobId: string): Promise<FixCandidate[]> {
    const rows = await this.client.fixCandidate.findMany({
      where: { page: { crawlJobId } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<FixCandidate | null> {
    const row = await this.client.fixCandidate.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async save(fixCandidate: FixCandidate): Promise<void> {
    await this.client.fixCandidate.update({
      where: { id: fixCandidate.id },
      data: { status: fixCandidate.status, previousValue: fixCandidate.previousValue },
    });
  }
}
