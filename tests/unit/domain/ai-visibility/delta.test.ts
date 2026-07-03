import { describe, expect, it } from "vitest";
import { computeAiVisibilityDelta } from "@/domain/ai-visibility/services/delta";
import { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";
import type { QueryOutcome } from "@/domain/ai-visibility/entities/probe-run";

function run(outcomes: QueryOutcome[], runAt: string): AiVisibilityProbeRun {
  return AiVisibilityProbeRun.reconstitute({
    id: crypto.randomUUID(),
    projectId: "p1",
    samplesPerQuery: 1,
    runAt: new Date(runAt),
    outcomes,
  });
}

describe("computeAiVisibilityDelta", () => {
  it("reports percentage movement and per-query slot changes", () => {
    const previous = run(
      [
        { query: "q1", slots: ["CONTESTED"], competitorsMentioned: [] },
        { query: "q2", slots: ["OPEN"], competitorsMentioned: [] },
      ],
      "2026-07-01"
    );
    const current = run(
      [
        { query: "q1", slots: ["MENTIONED"], competitorsMentioned: [] }, // won it
        { query: "q2", slots: ["OPEN"], competitorsMentioned: [] }, // unchanged
      ],
      "2026-07-02"
    );

    const delta = computeAiVisibilityDelta(previous, current);

    expect(delta.previousRunAt).toBe("2026-07-01T00:00:00.000Z");
    expect(delta.mentionedPctDelta).toBe(50); // 0% -> 50%
    expect(delta.contestedPctDelta).toBe(-50); // 50% -> 0%
    expect(delta.changes).toEqual([{ query: "q1", from: "CONTESTED", to: "MENTIONED" }]);
  });

  it("ignores queries not present in both runs", () => {
    const previous = run([{ query: "old", slots: ["CONTESTED"], competitorsMentioned: [] }], "2026-07-01");
    const current = run([{ query: "new", slots: ["MENTIONED"], competitorsMentioned: [] }], "2026-07-02");

    const delta = computeAiVisibilityDelta(previous, current);

    expect(delta.changes).toEqual([]);
  });
});
