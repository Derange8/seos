import { describe, expect, it } from "vitest";
import { buildScorecard } from "@/domain/ai-visibility/services/scorecard";
import type { QueryOutcome } from "@/domain/ai-visibility/entities/probe-run";

describe("buildScorecard", () => {
  const outcomes: QueryOutcome[] = [
    { query: "q1", slots: ["CONTESTED", "CONTESTED"], competitorsMentioned: ["Polymarket", "Augur"], citedSamples: 0, citations: [] },
    { query: "q2", slots: ["MENTIONED", "MENTIONED"], competitorsMentioned: [], citedSamples: 2, citations: [{ url: "https://acme.com" }] },
    { query: "q3", slots: ["OPEN", "OPEN"], competitorsMentioned: [], citedSamples: 1, citations: [{ url: "https://acme.com/x" }] },
    { query: "q4", slots: ["OPEN", "CONTESTED"], competitorsMentioned: ["Polymarket"], citedSamples: 0, citations: [] },
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

  it("sums cited samples across queries and computes a citation percentage", () => {
    const sc = buildScorecard(outcomes);
    // q2 cited 2 + q3 cited 1 = 3 of 8 samples.
    expect(sc.citedSamples).toBe(3);
    expect(sc.citedPct).toBe(38); // 3/8 = 37.5 -> 38
  });

  it("ranks competitors by how many queries they appeared in", () => {
    const sc = buildScorecard(outcomes);
    expect(sc.competitorFrequency).toEqual([
      { name: "Polymarket", queryCount: 2 },
      { name: "Augur", queryCount: 1 },
    ]);
  });

  it("lists only confident OPEN queries as winnable, and split ones as low-confidence", () => {
    const sc = buildScorecard(outcomes);
    // q3 all-OPEN (consensus 1.0) -> winnable. q4 is a 1/1 OPEN/CONTESTED split
    // (consensus 0.5, under threshold) -> NOT winnable, flagged low-confidence.
    expect(sc.winnableQueries).toEqual(["q3"]);
    expect(sc.lowConfidenceQueries).toEqual(["q4"]);
  });

  it("keeps a low-consensus OPEN out of winnable (a coin-flip isn't an opportunity)", () => {
    // OPEN is the plurality (3 of 6) but consensus is only 0.5, under threshold.
    const sc = buildScorecard([
      { query: "shaky", slots: ["OPEN", "OPEN", "OPEN", "CONTESTED", "CONTESTED", "MENTIONED"], competitorsMentioned: [], citedSamples: 0, citations: [] },
    ]);
    expect(sc.winnableQueries).toEqual([]);
    expect(sc.lowConfidenceQueries).toEqual(["shaky"]);
  });

  it("handles an empty run without dividing by zero", () => {
    const sc = buildScorecard([]);
    expect(sc.totalSamples).toBe(0);
    expect(sc.openPct).toBe(0);
    expect(sc.winnableQueries).toEqual([]);
  });
});
