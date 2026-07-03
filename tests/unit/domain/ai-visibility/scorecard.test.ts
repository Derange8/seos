import { describe, expect, it } from "vitest";
import { buildScorecard } from "@/domain/ai-visibility/services/scorecard";
import type { QueryOutcome } from "@/domain/ai-visibility/entities/probe-run";

describe("buildScorecard", () => {
  const outcomes: QueryOutcome[] = [
    { query: "q1", slots: ["CONTESTED", "CONTESTED"], competitorsMentioned: ["Polymarket", "Augur"] },
    { query: "q2", slots: ["MENTIONED", "MENTIONED"], competitorsMentioned: [] },
    { query: "q3", slots: ["OPEN", "OPEN"], competitorsMentioned: [] },
    { query: "q4", slots: ["OPEN", "CONTESTED"], competitorsMentioned: ["Polymarket"] },
  ];

  it("counts slots at the sample level and computes percentages", () => {
    const sc = buildScorecard(outcomes);
    expect(sc.totalSamples).toBe(8);
    expect(sc.mentioned).toBe(2);
    expect(sc.contested).toBe(3);
    expect(sc.open).toBe(3);
    expect(sc.mentionedPct).toBe(25);
    expect(sc.contestedPct).toBe(38); // 3/8 = 37.5 -> 38
    expect(sc.openPct).toBe(38);
  });

  it("ranks competitors by how many queries they appeared in", () => {
    const sc = buildScorecard(outcomes);
    expect(sc.competitorFrequency).toEqual([
      { name: "Polymarket", queryCount: 2 },
      { name: "Augur", queryCount: 1 },
    ]);
  });

  it("lists only queries whose dominant slot is OPEN as winnable", () => {
    const sc = buildScorecard(outcomes);
    // q3 all-OPEN -> winnable; q4 is an OPEN/CONTESTED tie -> CONTESTED (not winnable)
    expect(sc.winnableQueries).toEqual(["q3"]);
  });

  it("handles an empty run without dividing by zero", () => {
    const sc = buildScorecard([]);
    expect(sc.totalSamples).toBe(0);
    expect(sc.openPct).toBe(0);
    expect(sc.winnableQueries).toEqual([]);
  });
});
