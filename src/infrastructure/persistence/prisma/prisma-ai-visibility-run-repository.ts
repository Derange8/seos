import type { PrismaClient } from "@/generated/prisma/client";
import type { AiVisibilityRunRepositoryPort } from "@/application/ai-visibility/ports/ai-visibility-run-repository-port";
import { AiVisibilityProbeRun, type QueryOutcome } from "@/domain/ai-visibility/entities/probe-run";
import type { Slot } from "@/domain/ai-visibility/slot";

const VALID_SLOTS: readonly Slot[] = ["MENTIONED", "CONTESTED", "OPEN"];

// outcomes is a plain JSON column, not type-checked by the DB — same
// defensive coercion as KeywordCannibalization's pages.
function toDomainOutcomes(raw: unknown): QueryOutcome[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): QueryOutcome[] => {
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate?.query !== "string") return [];
    const slots = Array.isArray(candidate.slots)
      ? candidate.slots.filter((s): s is Slot => VALID_SLOTS.includes(s as Slot))
      : [];
    const competitorsMentioned = Array.isArray(candidate.competitorsMentioned)
      ? candidate.competitorsMentioned.filter((c): c is string => typeof c === "string")
      : [];
    return [{ query: candidate.query, slots, competitorsMentioned }];
  });
}

export class PrismaAiVisibilityRunRepository implements AiVisibilityRunRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async save(run: AiVisibilityProbeRun): Promise<void> {
    await this.client.aiVisibilityProbeRun.create({
      data: {
        id: run.id,
        projectId: run.projectId,
        samplesPerQuery: run.samplesPerQuery,
        outcomes: run.outcomes.map((o) => ({
          query: o.query,
          slots: [...o.slots],
          competitorsMentioned: [...o.competitorsMentioned],
        })),
        runAt: run.runAt,
      },
    });
  }

  async findLatestByProjectId(projectId: string): Promise<AiVisibilityProbeRun | null> {
    const row = await this.client.aiVisibilityProbeRun.findFirst({
      where: { projectId },
      orderBy: { runAt: "desc" },
    });
    if (!row) return null;

    return AiVisibilityProbeRun.reconstitute({
      id: row.id,
      projectId: row.projectId,
      samplesPerQuery: row.samplesPerQuery,
      runAt: row.runAt,
      outcomes: toDomainOutcomes(row.outcomes),
    });
  }

  async findRecentByProjectId(projectId: string, limit: number): Promise<AiVisibilityProbeRun[]> {
    const rows = await this.client.aiVisibilityProbeRun.findMany({
      where: { projectId },
      orderBy: { runAt: "desc" },
      take: limit,
    });

    return rows.map((row) =>
      AiVisibilityProbeRun.reconstitute({
        id: row.id,
        projectId: row.projectId,
        samplesPerQuery: row.samplesPerQuery,
        runAt: row.runAt,
        outcomes: toDomainOutcomes(row.outcomes),
      })
    );
  }
}
