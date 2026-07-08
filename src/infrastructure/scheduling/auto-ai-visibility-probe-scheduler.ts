import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaProjectRepository } from "@/infrastructure/persistence/prisma/prisma-project-repository";
import { PrismaAiVisibilityRunRepository } from "@/infrastructure/persistence/prisma/prisma-ai-visibility-run-repository";
import { PrismaVisibilityExperimentRepository } from "@/infrastructure/persistence/prisma/prisma-visibility-experiment-repository";
import { PrismaLlmSettingsRepository } from "@/infrastructure/persistence/prisma/prisma-llm-settings-repository";
import { PrismaLlmCredentialRepository } from "@/infrastructure/persistence/prisma/prisma-llm-credential-repository";
import { DynamicAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/dynamic-ai-visibility-model";
import { createAiVisibilityModel } from "@/infrastructure/llm/ai-visibility/create-ai-visibility-model";
import { RunAiVisibilityProbeUseCase } from "@/application/ai-visibility/use-cases/run-ai-visibility-probe-use-case";
import { RunMultiEngineProbeUseCase } from "@/application/ai-visibility/use-cases/run-multi-engine-probe-use-case";
import { ResolveVisibilityExperimentsUseCase } from "@/application/ai-visibility/use-cases/resolve-visibility-experiments-use-case";
import type { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";
import type { ProbeTarget } from "@/domain/ai-visibility/entities/probe-target";
import type { Project } from "@/domain/projects/entities/project";
import type { Logger } from "@/shared/logger";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly tick, same cadence as the other schedulers
const PROBE_DUE_AFTER_MS = 24 * 60 * 60 * 1000; // once a day
const INITIAL_CHECK_DELAY_MS = 30 * 1000;

// "Otomatik Pilot" reuses the same enabled flag the crawl/fix-apply half
// already uses (project.autoPilotEnabled) rather than a new toggle — for
// this feature, "watch this project automatically" already covers
// visibility measurement conceptually, not just crawling. Same
// in-process-timer shape as AutoPilotScheduler/startGoogleTrackingScheduler:
// no OS-level cron, a day is simply skipped and caught up at next launch if
// the app isn't running.
//
// There is no persisted ProbeTarget yet (see probe-target.ts's own comment
// — settings UI is a future step), so this scheduler re-probes with
// whatever queries the project's own MOST RECENT run already covered
// (AiVisibilityProbeRun.outcomes carries the query list each run used) —
// the same target a human last measured, not a guess. A project with no
// prior run at all has nothing to repeat, so it's simply skipped until the
// user runs a first manual/suggested probe.
export function startAutoAiVisibilityProbeScheduler(logger: Logger): { stop(): void } {
  const projectRepository = new PrismaProjectRepository(prisma);
  const runRepository = new PrismaAiVisibilityRunRepository(prisma);
  const experimentRepository = new PrismaVisibilityExperimentRepository(prisma);
  const credentialRepository = new PrismaLlmCredentialRepository(prisma);
  // Scheduled probes measure on ALL configured engines (multi-engine, Faz 5.6)
  // and sample adaptively (min 3, up to 5), matching what "Compare engines"
  // does by hand — the auto trend shouldn't lag behind the manual one.
  const runMultiEngine = new RunMultiEngineProbeUseCase({
    credentialRepository,
    runRepository,
    modelFactory: createAiVisibilityModel,
    samplesPerQuery: 3,
    maxSamplesPerQuery: 5,
    logger,
  });
  // Fallback for installs that only configured the single "AI Provider"
  // (LlmSettings) and never added measurement-engine credentials — keeps the
  // pre-Faz-5.5 single-engine behavior working.
  const singleEngineProbe = new RunAiVisibilityProbeUseCase({
    model: new DynamicAiVisibilityModel(new PrismaLlmSettingsRepository(prisma), logger),
    runRepository,
    samplesPerQuery: 3,
    maxSamplesPerQuery: 5,
    logger,
  });
  const resolveExperiments = new ResolveVisibilityExperimentsUseCase({ experimentRepository });

  async function tickForProject(project: Project): Promise<void> {
    if (!project.autoPilotEnabled) return;

    const latestRun = await runRepository.findLatestByProjectId(project.id);
    if (!latestRun || latestRun.outcomes.length === 0) return; // nothing to repeat yet

    const isDue = Date.now() - latestRun.runAt.getTime() >= PROBE_DUE_AFTER_MS;
    if (!isDue) return;

    const queries = latestRun.outcomes.map((o) => o.query);
    // Competitors aren't carried on the run the same way queries are
    // (competitorsMentioned is what the MODEL saw per query, not the
    // known-competitor seed list the original manual call was given) —
    // an empty list here still works fine, since the model's own judgement
    // (namesSpecificOption) covers unlisted competitors regardless.
    const domain = project.domain.value;
    const firstLabel = domain.split(".")[0] ?? domain;
    const target: ProbeTarget = {
      brand: project.name,
      domain,
      aliases: [...new Set([project.name, domain, firstLabel].filter((s) => s.length > 0))],
      competitors: [],
      queries,
    };

    logger.info("Otomatik Pilot: starting scheduled AI-visibility probe", {
      projectId: project.id,
      queryCount: queries.length,
    });

    try {
      // Scheduled (Otomatik Pilot) probes measure the real AI-search surface on
      // every configured engine. Each engine produces its own run; resolve
      // experiments against each.
      const { runs, failed } = await runMultiEngine.execute(project.id, target, "web_grounded");
      let measured: AiVisibilityProbeRun[] = runs;

      // No measurement-engine credentials configured → fall back to the single
      // active LlmSettings so pre-Faz-5.5 installs keep getting a scheduled run.
      if (runs.length === 0 && failed.length === 0) {
        measured = [await singleEngineProbe.execute(project.id, target, "web_grounded")];
      }

      for (const run of measured) {
        await resolveExperiments.execute(project.id, run);
      }
      if (failed.length > 0) {
        logger.warn("Otomatik Pilot: some engines couldn't be measured", {
          projectId: project.id,
          failed: failed.map((f) => f.engine),
        });
      }
    } catch (error) {
      logger.error("Otomatik Pilot: scheduled AI-visibility probe failed", {
        projectId: project.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Same re-entrancy guard as AutoPilotScheduler/google-tracking-scheduler
  // — setInterval doesn't wait for a previous async tick to finish.
  let isTicking = false;
  async function tick(): Promise<void> {
    if (isTicking) {
      logger.warn("AI-visibility probe scheduler tick still running, skipping this interval");
      return;
    }
    isTicking = true;
    try {
      const projects = await projectRepository.findAll();
      for (const project of projects) {
        try {
          await tickForProject(project);
        } catch (error) {
          logger.error("AI-visibility probe scheduler tick failed", {
            projectId: project.id,
            error: String(error),
          });
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
