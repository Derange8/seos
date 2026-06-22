import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { requireProjectAccess, type ProjectAccessResult } from "@/infrastructure/auth/require-project-access";

// Every /api/v1/projects/[id]/crawl/[jobId]/** route needs both checks: the
// project id exists, AND the crawl job actually belongs to that project —
// otherwise a stale/mismatched jobId paired with a valid projectId would
// read the wrong job's data instead of 404ing.
export async function requireCrawlJobAccess(projectId: string, jobId: string): Promise<ProjectAccessResult> {
  const access = await requireProjectAccess(projectId);
  if (access.error) return access;

  const crawlJob = await prisma.crawlJob.findUnique({ where: { id: jobId }, select: { projectId: true } });
  if (!crawlJob || crawlJob.projectId !== projectId) {
    return { error: "NOT_FOUND" };
  }

  return access;
}
