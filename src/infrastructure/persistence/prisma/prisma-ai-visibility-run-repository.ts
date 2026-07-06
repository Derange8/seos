import type { PrismaClient } from "@/generated/prisma/client";
import type { AiVisibilityRunRepositoryPort } from "@/application/ai-visibility/ports/ai-visibility-run-repository-port";
import { AiVisibilityProbeRun, type QueryOutcome } from "@/domain/ai-visibility/entities/probe-run";
import type { Slot } from "@/domain/ai-visibility/slot";
import type { Citation, GroundingMode } from "@/application/ai-visibility/ports/ai-visibility-model-port";

const VALID_SLOTS: readonly Slot[] = ["MENTIONED", "CONTESTED", "OPEN"];

function toGroundingMode(raw: unknown): GroundingMode {
  return raw === "web_grounded" ? "web_grounded" : "parametric";
}

// Coerce the citations sub-array of a JSON outcome, keeping only well-formed
// {url, title?} entries (the column isn't DB-type-checked).
function toCitations(raw: unknown): Citation[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): Citation[] => {
    const c = entry as Record<string, unknown>;
    if (typeof c?.url !== "string" || c.url.length === 0) return [];
    return [typeof c.title === "string" ? { url: c.url, title: c.title } : { url: c.url }];
  });
}

// outcomes is a plain JSON column, not type-checked by the DB — same
// defensive coercion as KeywordCannibalization's pages. Older rows have no
// citedSamples/citations (they predate web-grounded probing) → default to
// 0/[], the honest reading for a parametric run.
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
    const citedSamples = typeof candidate.citedSamples === "number" ? candidate.citedSamples : 0;
    return [{ query: candidate.query, slots, competitorsMentioned, citedSamples, citations: toCitations(candidate.citations) }];
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
        groundingMode: run.groundingMode,
        engine: run.engine,
        outcomes: run.outcomes.map((o) => ({
          query: o.query,
          slots: [...o.slots],
          competitorsMentioned: [...o.competitorsMentioned],
          citedSamples: o.citedSamples,
          citations: o.citations.map((c) => (c.title !== undefined ? { url: c.url, title: c.title } : { url: c.url })),
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
      groundingMode: toGroundingMode(row.groundingMode),
      engine: row.engine ?? "openai",
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
        groundingMode: toGroundingMode(row.groundingMode),
        engine: row.engine ?? "openai",
        runAt: row.runAt,
        outcomes: toDomainOutcomes(row.outcomes),
      })
    );
  }
}
