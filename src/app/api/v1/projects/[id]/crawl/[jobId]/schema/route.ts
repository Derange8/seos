import { NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaSchemaMarkupRepository } from "@/infrastructure/persistence/prisma/prisma-schema-markup-repository";
import { toSchemaMarkupDto } from "@/application/schema-markup/dto";
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

  const schemaMarkup = await new PrismaSchemaMarkupRepository(prisma).findAllByCrawlJobId(jobId);

  return NextResponse.json(schemaMarkup.map(toSchemaMarkupDto));
}
