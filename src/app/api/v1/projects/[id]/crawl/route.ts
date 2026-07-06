import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { crawlQueue } from "@/infrastructure/pipeline/crawl-pipeline";
import { StartCrawlUseCase } from "@/application/crawling/use-cases/start-crawl-use-case";
import type { CrawlConfigProps } from "@/domain/crawling/value-objects/crawl-config";
import { Url } from "@/domain/crawling/value-objects/url";
import { toCrawlJobDto } from "@/application/crawling/dto";
import { requireProjectAccess } from "@/infrastructure/auth/require-project-access";

const ERROR_STATUS: Record<string, number> = {
  PROJECT_NOT_FOUND: 404,
  DOMAIN_NOT_VERIFIED: 403,
  CRAWL_ALREADY_IN_PROGRESS: 409,
};

// Lets the dashboard restore "what happened last time" on page load —
// without this, a fresh page load only ever shows results from a crawl
// started in the current browser session, even though the data is sitting
// in the database from any earlier session.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireProjectAccess(id);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const crawlJob = await new PrismaCrawlJobRepository(prisma).findLatestByProjectId(id);
  return NextResponse.json(crawlJob ? toCrawlJobDto(crawlJob) : null);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const access = await requireProjectAccess(id);
  if (access.error === "NOT_FOUND") {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  const projectRepository = new PrismaProjectRepository(prisma);
  const project = await projectRepository.findById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found", code: "PROJECT_NOT_FOUND" }, { status: 404 });
  }

  const rootUrlResult = Url.create(`https://${project.domain.value}/`);
  if (!rootUrlResult.ok) {
    return NextResponse.json({ error: rootUrlResult.error.message }, { status: 400 });
  }

  // Only forward fields the caller actually provided — spreading `undefined`
  // values into CrawlConfig.create()'s overrides would clobber its defaults.
  const configOverrides: Partial<CrawlConfigProps> = {};
  if (typeof body.maxDepth === "number") configOverrides.maxDepth = body.maxDepth;
  if (typeof body.maxPages === "number") configOverrides.maxPages = body.maxPages;
  if (typeof body.respectRobots === "boolean") configOverrides.respectRobots = body.respectRobots;
  if (typeof body.concurrency === "number") configOverrides.concurrency = body.concurrency;
  if (typeof body.deepCsrCheck === "boolean") configOverrides.deepCsrCheck = body.deepCsrCheck;
  if (typeof body.measureWebVitals === "boolean") configOverrides.measureWebVitals = body.measureWebVitals;

  const useCase = new StartCrawlUseCase({
    crawlJobRepository: new PrismaCrawlJobRepository(prisma),
    projectRepository,
    queue: crawlQueue,
  });

  const result = await useCase.execute(id, rootUrlResult.value, configOverrides);
  if (!result.ok) {
    const status = ERROR_STATUS[result.error.code] ?? 400;
    return NextResponse.json({ error: result.error.message, code: result.error.code }, { status });
  }

  return NextResponse.json(toCrawlJobDto(result.value), { status: 201 });
}
