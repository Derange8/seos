import type { PrismaClient } from "@/generated/prisma/client";
import type { VisibilityExperimentRepositoryPort } from "@/application/ai-visibility/ports/visibility-experiment-repository-port";
import {
  VisibilityExperiment,
  type ExperimentStatus,
} from "@/domain/ai-visibility/entities/visibility-experiment";
import type { Slot } from "@/domain/ai-visibility/slot";

const VALID_SLOTS: readonly Slot[] = ["MENTIONED", "CONTESTED", "OPEN"];

function toSlot(raw: string): Slot {
  return VALID_SLOTS.includes(raw as Slot) ? (raw as Slot) : "CONTESTED";
}

function toNullableSlot(raw: string | null): Slot | null {
  return raw === null ? null : toSlot(raw);
}

interface ExperimentRow {
  id: string;
  projectId: string;
  query: string;
  baselineSlot: string;
  baselineRunAt: Date;
  actionAt: Date;
  status: string;
  outcomeSlot: string | null;
  outcomeRunAt: Date | null;
}

function toDomain(row: ExperimentRow): VisibilityExperiment {
  return VisibilityExperiment.reconstitute({
    id: row.id,
    projectId: row.projectId,
    query: row.query,
    baselineSlot: toSlot(row.baselineSlot),
    baselineRunAt: row.baselineRunAt,
    actionAt: row.actionAt,
    status: row.status === "RESOLVED" ? "RESOLVED" : "OPEN",
    outcomeSlot: toNullableSlot(row.outcomeSlot),
    outcomeRunAt: row.outcomeRunAt,
  });
}

export class PrismaVisibilityExperimentRepository implements VisibilityExperimentRepositoryPort {
  constructor(private readonly client: PrismaClient) {}

  async save(experiment: VisibilityExperiment): Promise<void> {
    const status: ExperimentStatus = experiment.status;
    const data = {
      projectId: experiment.projectId,
      query: experiment.query,
      baselineSlot: experiment.baselineSlot,
      baselineRunAt: experiment.baselineRunAt,
      actionAt: experiment.actionAt,
      status,
      outcomeSlot: experiment.outcomeSlot,
      outcomeRunAt: experiment.outcomeRunAt,
    };
    await this.client.visibilityExperiment.upsert({
      where: { id: experiment.id },
      create: { id: experiment.id, ...data },
      update: data,
    });
  }

  async findByProjectId(projectId: string): Promise<VisibilityExperiment[]> {
    const rows = await this.client.visibilityExperiment.findMany({
      where: { projectId },
      orderBy: { actionAt: "desc" },
    });
    return rows.map(toDomain);
  }

  async findOpenByProjectId(projectId: string): Promise<VisibilityExperiment[]> {
    const rows = await this.client.visibilityExperiment.findMany({
      where: { projectId, status: "OPEN" },
      orderBy: { actionAt: "desc" },
    });
    return rows.map(toDomain);
  }

  async findOpenByProjectAndQuery(projectId: string, query: string): Promise<VisibilityExperiment | null> {
    const row = await this.client.visibilityExperiment.findFirst({
      where: { projectId, query, status: "OPEN" },
    });
    return row ? toDomain(row) : null;
  }
}
