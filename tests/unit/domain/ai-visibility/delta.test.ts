import { describe, expect, it } from "vitest";
import { computeAiVisibilityDelta } from "@/domain/ai-visibility/services/delta";
import { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";
import type { QueryOutcome } from "@/domain/ai-visibility/entities/probe-run";
import type { Slot } from "@/domain/ai-visibility/slot";

// Minimal outcome for delta tests. citedSamples defaults to 0 (parametric
// reading); pass it to exercise the citation-axis delta.
function oc(query: string, slots: Slot[], citedSamples = 0): QueryOutcome {
  return { query, slots, competitorsMentioned: [], citedSamples, citations: [] };
}

function run(outcomes: QueryOutcome[], runAt: string): AiVisibilityProbeRun {
  return AiVisibilityProbeRun.reconstitute({
    id: crypto.randomUUID(),
    projectId: "p1",
    samplesPerQuery: 1,
    groundingMode: "parametric",
    runAt: new Date(runAt),
    outcomes,
  });
}

describe("computeAiVisibilityDelta", () => {
  it("reports percentage movement and per-query slot changes", () => {
    const previous = run(
      [
        oc("q1", ["CONTESTED"]),
        oc("q2", ["OPEN"]),
      ],
      "2026-07-01"
    );
    const current = run(
      [
        oc("q1", ["MENTIONED"]), // won it
        oc("q2", ["OPEN"]), // unchanged
      ],
      "2026-07-02"
    );

    const delta = computeAiVisibilityDelta(previous, current);

    expect(delta.previousRunAt).toBe("2026-07-01T00:00:00.000Z");
    expect(delta.mentionedPctDelta).toBe(50); // 0% -> 50%
    expect(delta.contestedPctDelta).toBe(-50); // 50% -> 0%
    expect(delta.changes).toEqual([{ query: "q1", from: "CONTESTED", to: "MENTIONED" }]);
  });

  it("reports citation percentage movement across runs", () => {
    // 2 queries × 1 sample each. Previous: 0 cited. Current: 1 cited → +50%.
    const previous = run([oc("q1", ["OPEN"], 0), oc("q2", ["OPEN"], 0)], "2026-07-01");
    const current = run([oc("q1", ["OPEN"], 1), oc("q2", ["OPEN"], 0)], "2026-07-02");

    const delta = computeAiVisibilityDelta(previous, current);

    expect(delta.citedPctDelta).toBe(50); // 0% -> 50%
  });

  it("ignores queries not present in both runs", () => {
    const previous = run([oc("old", ["CONTESTED"])], "2026-07-01");
    const current = run([oc("new", ["MENTIONED"])], "2026-07-02");

    const delta = computeAiVisibilityDelta(previous, current);

    expect(delta.changes).toEqual([]);
  });
});
