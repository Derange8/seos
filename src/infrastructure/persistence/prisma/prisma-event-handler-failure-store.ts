import type { PrismaClient } from "@/generated/prisma/client";
import type {
  EventHandlerFailure,
  EventHandlerFailureStore,
  RecordEventHandlerFailureInput,
} from "@/shared/event-handler-failure-store";

const DEFAULT_LIMIT = 20;

export class PrismaEventHandlerFailureStore implements EventHandlerFailureStore {
  constructor(private readonly client: PrismaClient) {}

  async record(input: RecordEventHandlerFailureInput): Promise<void> {
    await this.client.eventHandlerFailure.create({
      data: { projectId: input.projectId, eventType: input.eventType, message: input.message },
    });
  }

  async findRecentByProjectId(projectId: string, limit: number = DEFAULT_LIMIT): Promise<EventHandlerFailure[]> {
    const rows = await this.client.eventHandlerFailure.findMany({
      where: { projectId },
      // Tiebreaker on id (cuid()s are monotonically increasing) — SQLite's
      // millisecond-resolution timestamps mean several failures recorded
      // back-to-back can land on the exact same occurredAt value, which
      // makes "most recent first" non-deterministic on occurredAt alone.
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      eventType: row.eventType,
      message: row.message,
      occurredAt: row.occurredAt,
    }));
  }
}
