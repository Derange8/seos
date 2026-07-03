import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { PrismaCrawlJobRepository } from "@/infrastructure/persistence/prisma/prisma-crawl-job-repository";
import { StartCrawlUseCase } from "@/application/crawling/use-cases/start-crawl-use-case";
import { Url } from "@/domain/crawling/value-objects/url";
import type { Project } from "@/domain/projects/entities/project";
import type { InProcessCrawlQueue } from "@/infrastructure/queue/in-process/in-process-crawl-queue";
import type { Logger } from "@/shared/logger";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly tick, same cadence as the Google tracking scheduler
const RECRAWL_DUE_AFTER_MS = 24 * 60 * 60 * 1000; // once a day
const INITIAL_CHECK_DELAY_MS = 30 * 1000;

// "Otomatik Pilot" autonomy, half: the other half is
// AutoApplyApprovedFixesUseCase, wired as a pipeline event handler since
// it reacts to a crawl that's already running, not a separate clock. This
// scheduler is the half that actually starts a crawl in the first place —
// same in-process-timer shape as startGoogleTrackingScheduler (see that
// file's own comment for why there's no OS-level cron: if the app isn't
// running, a day is simply skipped and caught up at next launch).
export function startAutoPilotScheduler(crawlQueue: InProcessCrawlQueue, logger: Logger): { stop(): void } {
  const projectRepository = new PrismaProjectRepository(prisma);
  const crawlJobRepository = new PrismaCrawlJobRepository(prisma);
  const startCrawl = new StartCrawlUseCase({ crawlJobRepository, projectRepository, queue: crawlQueue });

  async function tickForProject(project: Project): Promise<void> {
    if (!project.autoPilotEnabled) return;

    const latestJob = await crawlJobRepository.findLatestByProjectId(project.id);
    // A still-running crawl isn't "due" regardless of age — and
    // StartCrawlUseCase would reject it anyway (CrawlAlreadyInProgressError);
    // checking here just avoids a noisy, expected-to-fail call every tick.
    if (latestJob && (latestJob.status === "PENDING" || latestJob.status === "RUNNING")) return;

    const isDue = !latestJob?.finishedAt || Date.now() - latestJob.finishedAt.getTime() >= RECRAWL_DUE_AFTER_MS;
    if (!isDue) return;

    const rootUrlResult = Url.create(`https://${project.domain.value}/`);
    if (!rootUrlResult.ok) {
      logger.error("Otomatik Pilot: invalid project domain, skipping re-crawl", {
        projectId: project.id,
        domain: project.domain.value,
      });
      return;
    }

    logger.info("Otomatik Pilot: starting scheduled re-crawl", { projectId: project.id });
    const result = await startCrawl.execute(project.id, rootUrlResult.value);
    if (!result.ok) {
      logger.error("Otomatik Pilot: scheduled re-crawl failed to start", {
        projectId: project.id,
        error: result.error.message,
      });
    }
  }

  // Same per-project isolation as the Google tracking scheduler's tick() —
  // one project's failure must never stop the rest from being checked.
  let isTicking = false;
  async function tick(): Promise<void> {
    // setInterval doesn't wait for a previous async callback to finish — if
    // checking every project ever takes longer than CHECK_INTERVAL_MS (many
    // projects, or a slow/hung crawl-start call), the next tick would
    // otherwise start concurrently and could race a still-in-flight
    // tickForProject for the same project.
    if (isTicking) {
      logger.warn("Otomatik Pilot scheduler tick still running, skipping this interval");
      return;
    }
    isTicking = true;
    try {
      const projects = await projectRepository.findAll();
      for (const project of projects) {
        try {
          await tickForProject(project);
        } catch (error) {
          logger.error("Otomatik Pilot scheduler tick failed", { projectId: project.id, error: String(error) });
        }
      }
    } finally {
      isTicking = false;
    }
  }

  const initialTimer = setTimeout(tick, INITIAL_CHECK_DELAY_MS);
  const interval = setInterval(tick, CHECK_INTERVAL_MS);

  return {
    stop() {
      clearTimeout(initialTimer);
      clearInterval(interval);
    },
  };
}
