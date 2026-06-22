import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaAuditRunRepository } from "@/infrastructure/persistence/prisma/prisma-audit-run-repository";
import { PrismaFixCandidateRepository } from "@/infrastructure/persistence/prisma/prisma-fix-candidate-repository";
import { PrismaPageRepository } from "@/infrastructure/persistence/prisma/prisma-page-repository";
import { PrismaPagePerformanceRepository } from "@/infrastructure/persistence/prisma/prisma-page-performance-repository";
import { toAuditRunDto } from "@/application/auditing/dto";
import { requireCrawlJobAccess } from "@/infrastructure/auth/require-crawl-job-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  const { id, jobId } = await params;

  const access = await requireCrawlJobAccess(id, jobId);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Crawl job not found" }, { status: 404 });
  }

  const auditRun = await new PrismaAuditRunRepository(prisma).findByCrawlJobId(jobId);
  if (!auditRun) {
    return NextResponse.json({ error: "No audit run for this crawl job yet" }, { status: 404 });
  }

  const fixCandidates = await new PrismaFixCandidateRepository(prisma).findAllByCrawlJobId(jobId);
  const pages = await new PrismaPageRepository(prisma).findAllByCrawlJobId(jobId);
  const pageUrlsByPageId = new Map(pages.map((page) => [page.id, page.url.href]));
  const pagePerformance = await new PrismaPagePerformanceRepository(prisma).findByProjectId(id);

  return NextResponse.json(toAuditRunDto(auditRun, fixCandidates, pageUrlsByPageId, pagePerformance));
}
