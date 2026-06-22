import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaSeoScoreRepository } from "@/infrastructure/persistence/prisma/prisma-seo-score-repository";
import { toSeoScoreDto } from "@/application/scoring/dto";
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

  const scores = await new PrismaSeoScoreRepository(prisma).findByCrawlJobId(jobId);

  // Only the site-level breakdown (pageId === null) is surfaced here — the
  // dashboard shows one category breakdown for the whole crawl, not a
  // per-page table; per-page rows still exist in the DB for a future UI.
  const siteLevel = scores.filter((score) => score.isSiteLevel);

  return NextResponse.json(siteLevel.map(toSeoScoreDto));
}
