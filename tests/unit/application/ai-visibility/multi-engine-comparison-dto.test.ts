import { describe, expect, it } from "vitest";
import { toMultiEngineComparisonDto } from "@/application/ai-visibility/dto";
import { AiVisibilityProbeRun, type QueryOutcome } from "@/domain/ai-visibility/entities/probe-run";
import type { Slot } from "@/domain/ai-visibility/slot";

function runFor(engine: string, slots: Slot[]): AiVisibilityProbeRun {
  const outcome: QueryOutcome = { query: "q", slots, competitorsMentioned: [], citedSamples: 0, citations: [] };
  return AiVisibilityProbeRun.reconstitute({
    id: `${engine}-run`,
    projectId: "p1",
    samplesPerQuery: slots.length,
    groundingMode: "web_grounded",
    engine,
    runAt: new Date("2026-07-06T00:00:00.000Z"),
    outcomes: [outcome],
  });
}

describe("toMultiEngineComparisonDto", () => {
  it("builds one entry per engine, best-mentioned-first, and carries failures", () => {
    const dto = toMultiEngineComparisonDto(
      [
        runFor("gemini", ["OPEN", "OPEN"]), // 0% mentioned
        runFor("openai", ["MENTIONED", "MENTIONED"]), // 100% mentioned
        runFor("anthropic", ["MENTIONED", "OPEN"]), // 50% mentioned
      ],
      [{ engine: "deepseek", error: "no web search" }]
    );

    // Sorted by mentionedPct descending.
    expect(dto.engines.map((e) => e.engine)).toEqual(["openai", "anthropic", "gemini"]);
    expect(dto.engines[0].mentionedPct).toBe(100);
    expect(dto.engines[2].mentionedPct).toBe(0);
    expect(dto.failed).toEqual([{ engine: "deepseek", error: "no web search" }]);
  });

  it("handles zero runs", () => {
    const dto = toMultiEngineComparisonDto([], []);
    expect(dto.engines).toEqual([]);
    expect(dto.failed).toEqual([]);
  });
});
