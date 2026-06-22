import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { toCrawlJobDto } from "@/application/crawling/dto";
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

  const crawlJob = await new PrismaCrawlJobRepository(prisma).findById(jobId);
  if (!crawlJob) {
    return NextResponse.json({ error: "Crawl job not found" }, { status: 404 });
  }

  return NextResponse.json(toCrawlJobDto(crawlJob));
}
