import { describe, expect, it } from "vitest";
import { toAiVisibilityRunDto } from "@/application/ai-visibility/dto";
import { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";

describe("toAiVisibilityRunDto", () => {
  it("maps a run to its scorecard plus a per-query breakdown", () => {
    const run = AiVisibilityProbeRun.reconstitute({
      id: "run-1",
      projectId: "project-1",
      samplesPerQuery: 2,
      runAt: new Date("2026-07-03T00:00:00.000Z"),
      outcomes: [
        { query: "q-open", slots: ["OPEN", "OPEN"], competitorsMentioned: [] },
        { query: "q-contested", slots: ["CONTESTED", "OPEN"], competitorsMentioned: ["Polymarket"] },
      ],
    });

    const dto = toAiVisibilityRunDto(run);

    expect(dto.runAt).toBe("2026-07-03T00:00:00.000Z");
    expect(dto.samplesPerQuery).toBe(2);
    expect(dto.scorecard.totalSamples).toBe(4);
    expect(dto.scorecard.openPct).toBe(75);
    expect(dto.scorecard.winnableQueries).toEqual(["q-open"]);

    const open = dto.queries.find((q) => q.query === "q-open");
    expect(open?.dominantSlot).toBe("OPEN");
    expect(open?.open).toBe(2);

    const contested = dto.queries.find((q) => q.query === "q-contested");
    // OPEN/CONTESTED tie resolves to CONTESTED (see dominantSlot).
    expect(contested?.dominantSlot).toBe("CONTESTED");
    expect(contested?.competitorsMentioned).toEqual(["Polymarket"]);
  });
});
