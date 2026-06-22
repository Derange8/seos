import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaFixCandidateRepository } from "@/infrastructure/persistence/prisma/prisma-fix-candidate-repository";
import { toFixCandidateDto } from "@/application/fixes/dto";
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

  const fixCandidates = await new PrismaFixCandidateRepository(prisma).findAllByCrawlJobId(jobId);

  return NextResponse.json(fixCandidates.map(toFixCandidateDto));
}
