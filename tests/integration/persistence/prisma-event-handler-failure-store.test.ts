import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { PrismaEventHandlerFailureStore } from "@/infrastructure/persistence/prisma/prisma-event-handler-failure-store";

describe("PrismaEventHandlerFailureStore", () => {
  const store = new PrismaEventHandlerFailureStore(prisma);
  let projectId: string;

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: "Event Failures Test Project", domain: `itest-${crypto.randomUUID()}.example.com` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });

  it("records a failure and finds it by projectId", async () => {
    await store.record({ projectId, eventType: "AuditRunCompleted", message: "boom" });

    const found = await store.findRecentByProjectId(projectId);

    expect(found).toHaveLength(1);
    expect(found[0]?.eventType).toBe("AuditRunCompleted");
    expect(found[0]?.message).toBe("boom");
    expect(found[0]?.occurredAt).toBeInstanceOf(Date);
  });

  it("orders results most-recent-first and respects the limit", async () => {
    const isolatedProject = await prisma.project.create({
      data: { name: "Isolated", domain: `itest-${crypto.randomUUID()}.example.com` },
    });

    await store.record({ projectId: isolatedProject.id, eventType: "First", message: "1" });
    await store.record({ projectId: isolatedProject.id, eventType: "Second", message: "2" });
    await store.record({ projectId: isolatedProject.id, eventType: "Third", message: "3" });

    const found = await store.findRecentByProjectId(isolatedProject.id, 2);

    expect(found).toHaveLength(2);
    expect(found.map((f) => f.eventType)).toEqual(["Third", "Second"]);
  });

  it("returns an empty array for a project with no failures", async () => {
    const found = await store.findRecentByProjectId(crypto.randomUUID());
    expect(found).toEqual([]);
  });
});
