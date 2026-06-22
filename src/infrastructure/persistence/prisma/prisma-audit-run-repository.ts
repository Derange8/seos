import type {
  PrismaClient,
  AuditRun as PrismaAuditRunRow,
  AuditIssue as PrismaAuditIssueRow,
} from "@/generated/prisma/client";
import type { AuditRunRepositoryPort } from "@/application/auditing/ports/audit-run-repository-port";
import { AuditRun, type AuditRunProps } from "@/domain/auditing/entities/audit-run";
import { AuditIssue, type AuditCategory, type AuditSeverity } from "@/domain/auditing/entities/audit-issue";
import { sqliteWriteLock } from "@/shared/async-mutex";

function toDomain(row: PrismaAuditRunRow & { issues: PrismaAuditIssueRow[] }): AuditRun {
  const issues = row.issues.map((issueRow) =>
    AuditIssue.reconstitute({
      id: issueRow.id,
      auditRunId: issueRow.auditRunId,
      pageId: issueRow.pageId,
      ruleId: issueRow.ruleId,
      category: issueRow.category as AuditCategory,
      severity: issueRow.severity as AuditSeverity,
      message: issueRow.message,
      recommendation: issueRow.recommendation,
      createdAt: issueRow.createdAt,
    })
  );

  const props: AuditRunProps = {
    id: row.id,
    projectId: row.projectId,
    crawlJobId: row.crawlJobId,
    issues,
    overallScore: row.overallScore,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };

  return AuditRun.reconstitute(props);
}

export class PrismaAuditRunRepository implements AuditRunRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async save(auditRun: AuditRun): Promise<void> {
    const data = {
      overallScore: auditRun.overallScore,
      finishedAt: auditRun.finishedAt,
    };

    // Runs right at the tail of crawling, while the last concurrent page
    // saves may still be settling on the same single better-sqlite3
    // connection — see AsyncMutex's doc comment.
    await sqliteWriteLock.runExclusive(() =>
      this.client.$transaction(async (tx) => {
        await tx.auditRun.upsert({
          where: { id: auditRun.id },
          create: {
            id: auditRun.id,
            projectId: auditRun.projectId,
            crawlJobId: auditRun.crawlJobId,
            startedAt: auditRun.startedAt,
            ...data,
          },
          update: data,
        });

        // Upsert per issue rather than delete-all-then-recreate: this save()
        // is called a second time once GenerateAuditRecommendationsUseCase
        // fills in `recommendation` on the same issues, and FixCandidate
        // rows carry an ON DELETE CASCADE foreign key to auditIssueId — a
        // wholesale delete here would silently wipe out every fix
        // candidate generated in between, with no error anywhere to catch
        // it. Issue ids are stable for the lifetime of an AuditRun, so this
        // is still a correct full sync of the current issue list.
        for (const issue of auditRun.issues) {
          const issueData = {
            auditRunId: issue.auditRunId,
            pageId: issue.pageId,
            ruleId: issue.ruleId,
            category: issue.category,
            severity: issue.severity,
            message: issue.message,
            recommendation: issue.recommendation,
            createdAt: issue.createdAt,
          };
          await tx.auditIssue.upsert({
            where: { id: issue.id },
            create: { id: issue.id, ...issueData },
            update: issueData,
          });
        }
      })
    );
  }

  async findById(id: string): Promise<AuditRun | null> {
    const row = await this.client.auditRun.findUnique({
      where: { id },
      include: { issues: true },
    });
    return row ? toDomain(row) : null;
  }

  async findByCrawlJobId(crawlJobId: string): Promise<AuditRun | null> {
    const row = await this.client.auditRun.findFirst({
      where: { crawlJobId },
      include: { issues: true },
      orderBy: { startedAt: "desc" },
    });
    return row ? toDomain(row) : null;
  }

  async findRecentByProjectId(projectId: string, limit: number): Promise<AuditRun[]> {
    const rows = await this.client.auditRun.findMany({
      where: { projectId, finishedAt: { not: null } },
      include: { issues: true },
      orderBy: { finishedAt: "desc" },
      take: limit,
    });
    return rows.map(toDomain);
  }
}
