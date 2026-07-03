import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import type { Project } from "@/domain/projects/entities/project";
import { PrismaGoogleConnectionRepository } from "@/infrastructure/persistence/prisma/prisma-google-connection-repository";
import { PrismaSearchPerformanceRepository } from "@/infrastructure/persistence/prisma/prisma-search-performance-repository";
import { PrismaAnalyticsSnapshotRepository } from "@/infrastructure/persistence/prisma/prisma-analytics-snapshot-repository";
import { PrismaKeywordOpportunityRepository } from "@/infrastructure/persistence/prisma/prisma-keyword-opportunity-repository";
import { PrismaKeywordCannibalizationRepository } from "@/infrastructure/persistence/prisma/prisma-keyword-cannibalization-repository";
import { PrismaCtrUnderperformerRepository } from "@/infrastructure/persistence/prisma/prisma-ctr-underperformer-repository";
import { PrismaPagePerformanceRepository } from "@/infrastructure/persistence/prisma/prisma-page-performance-repository";
import { SearchConsoleClient } from "@/infrastructure/google/search-console-client";
import { AnalyticsClient } from "@/infrastructure/google/analytics-client";
import { createGoogleOAuthClient } from "@/infrastructure/google/create-google-oauth-client";
import { FetchSearchPerformanceUseCase } from "@/application/tracking/use-cases/fetch-search-performance-use-case";
import { FetchAnalyticsUseCase, Ga4PropertyNotConfiguredError } from "@/application/tracking/use-cases/fetch-analytics-use-case";
import { FetchKeywordOpportunitiesUseCase } from "@/application/tracking/use-cases/fetch-keyword-opportunities-use-case";
import type { Logger } from "@/shared/logger";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly tick
const REFRESH_DUE_AFTER_MS = 24 * 60 * 60 * 1000; // once a day
const INITIAL_CHECK_DELAY_MS = 30 * 1000; // don't make the user wait a full hour after opening the app

// "Auto-refresh daily" (see GoogleConnection.autoRefreshEnabled) is just
// this: an in-process timer that periodically checks whether it's been
// ~24h since the last successful Google fetch, and if so, runs the exact
// same use cases the manual "Refresh now" button does. There is no OS-
// level cron or background service — if the app isn't running, the day
// is simply skipped and caught up on next launch (see project memory on
// the in-process-queue pivot for why this no-extra-service approach was
// chosen over anything heavier).
export function startGoogleTrackingScheduler(logger: Logger): { stop(): void } {
  // Google tracking is entirely optional — most installs won't have a
  // GOOGLE_OAUTH_CLIENT_ID configured at all, and that must never break
  // the rest of the app (crawling etc.) which this scheduler is wired
  // alongside in the same startup singleton.
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    logger.info("Google OAuth not configured — auto-refresh scheduler not started");
    return { stop() {} };
  }

  const oauthClient = createGoogleOAuthClient();
  const googleConnectionRepository = new PrismaGoogleConnectionRepository(prisma);
  const searchPerformanceRepository = new PrismaSearchPerformanceRepository(prisma);

  const fetchSearchPerformance = new FetchSearchPerformanceUseCase({
    googleOAuth: oauthClient,
    searchConsoleClient: new SearchConsoleClient(),
    googleConnectionRepository,
    searchPerformanceRepository,
  });
  const fetchAnalytics = new FetchAnalyticsUseCase({
    googleOAuth: oauthClient,
    analyticsClient: new AnalyticsClient(),
    googleConnectionRepository,
    analyticsSnapshotRepository: new PrismaAnalyticsSnapshotRepository(prisma),
  });
  const fetchKeywordOpportunities = new FetchKeywordOpportunitiesUseCase({
    googleOAuth: oauthClient,
    searchConsoleClient: new SearchConsoleClient(),
    googleConnectionRepository,
    keywordOpportunityRepository: new PrismaKeywordOpportunityRepository(prisma),
    pagePerformanceRepository: new PrismaPagePerformanceRepository(prisma),
    keywordCannibalizationRepository: new PrismaKeywordCannibalizationRepository(prisma),
    ctrUnderperformerRepository: new PrismaCtrUnderperformerRepository(prisma),
  });

  async function tickForProject(project: Project): Promise<void> {
    const connection = await googleConnectionRepository.findByProjectId(project.id);
    if (!connection || !connection.autoRefreshEnabled) return;

    const lastFetchedAt = await searchPerformanceRepository.findLatestFetchedAt(project.id);
    const isDue = !lastFetchedAt || Date.now() - lastFetchedAt.getTime() >= REFRESH_DUE_AFTER_MS;
    if (!isDue) return;

    logger.info("Auto-refreshing Google tracking data", { projectId: project.id });

    const searchResult = await fetchSearchPerformance.execute(project.id);
    if (!searchResult.ok) {
      logger.error("Auto-refresh: Search Console fetch failed", { error: searchResult.error.message });
    }

    const analyticsResult = await fetchAnalytics.execute(project.id);
    if (!analyticsResult.ok && !(analyticsResult.error instanceof Ga4PropertyNotConfiguredError)) {
      logger.error("Auto-refresh: Analytics fetch failed", { error: analyticsResult.error.message });
    }

    const keywordOpportunitiesResult = await fetchKeywordOpportunities.execute(project.id);
    if (!keywordOpportunitiesResult.ok) {
      logger.error("Auto-refresh: keyword opportunities fetch failed", {
        error: keywordOpportunitiesResult.error.message,
      });
    }
  }

  // One project failing (a revoked token, a transient API error) must not
  // stop the rest from being checked — isolated per-project, same principle
  // as DomainEventDispatcher's per-handler try/catch.
  let isTicking = false;
  async function tick(): Promise<void> {
    // setInterval doesn't wait for a previous async callback to finish — if
    // checking every project ever takes longer than CHECK_INTERVAL_MS (many
    // projects, or a slow/hung Google API call), the next tick would
    // otherwise start concurrently and could race a still-in-flight
    // tickForProject for the same project (e.g. two overlapping
    // replaceForProject calls for the same project's keyword data).
    if (isTicking) {
      logger.warn("Google tracking scheduler tick still running, skipping this interval");
      return;
    }
    isTicking = true;
    try {
      const projects = await new PrismaProjectRepository(prisma).findAll();
      for (const project of projects) {
        try {
          await tickForProject(project);
        } catch (error) {
          logger.error("Google tracking scheduler tick failed", { projectId: project.id, error: String(error) });
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
