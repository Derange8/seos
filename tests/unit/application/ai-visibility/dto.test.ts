import { describe, expect, it } from "vitest";
import { toAiVisibilityRunDto, toAiVisibilityTrendDto } from "@/application/ai-visibility/dto";
import { AiVisibilityProbeRun } from "@/domain/ai-visibility/entities/probe-run";

describe("toAiVisibilityRunDto", () => {
  it("maps a run to its scorecard plus a per-query breakdown", () => {
    const run = AiVisibilityProbeRun.reconstitute({
      id: "run-1",
      projectId: "project-1",
      samplesPerQuery: 2,
      groundingMode: "web_grounded",
      runAt: new Date("2026-07-03T00:00:00.000Z"),
      outcomes: [
        { query: "q-open", slots: ["OPEN", "OPEN"], competitorsMentioned: [], citedSamples: 1, citations: [{ url: "https://acme.com/a" }] },
        { query: "q-contested", slots: ["CONTESTED", "OPEN"], competitorsMentioned: ["Polymarket"], citedSamples: 0, citations: [] },
      ],
    });

    const dto = toAiVisibilityRunDto(run);

    expect(dto.runAt).toBe("2026-07-03T00:00:00.000Z");
    expect(dto.samplesPerQuery).toBe(2);
    expect(dto.groundingMode).toBe("web_grounded");
    expect(dto.scorecard.totalSamples).toBe(4);
    expect(dto.scorecard.openPct).toBe(75);
    expect(dto.scorecard.citedSamples).toBe(1);
    expect(dto.scorecard.winnableQueries).toEqual(["q-open"]);

    const open = dto.queries.find((q) => q.query === "q-open");
    expect(open?.dominantSlot).toBe("OPEN");
    expect(open?.open).toBe(2);
    expect(open?.citedSamples).toBe(1);
    expect(open?.citations).toEqual([{ url: "https://acme.com/a" }]);

    const contested = dto.queries.find((q) => q.query === "q-contested");
    // OPEN/CONTESTED tie resolves to CONTESTED (see dominantSlot).
    expect(contested?.dominantSlot).toBe("CONTESTED");
    expect(contested?.competitorsMentioned).toEqual(["Polymarket"]);
  });
});

describe("toAiVisibilityTrendDto", () => {
  function run(id: string, runAt: string, slots: readonly ("MENTIONED" | "CONTESTED" | "OPEN")[]): AiVisibilityProbeRun {
    return AiVisibilityProbeRun.reconstitute({
      id,
      projectId: "project-1",
      samplesPerQuery: slots.length,
      groundingMode: "parametric",
      runAt: new Date(runAt),
      outcomes: [{ query: "q", slots, competitorsMentioned: [], citedSamples: 0, citations: [] }],
    });
  }

  it("sorts runs oldest-first regardless of input order", () => {
    const newer = run("run-2", "2026-07-05T00:00:00.000Z", ["MENTIONED"]);
    const older = run("run-1", "2026-07-01T00:00:00.000Z", ["OPEN"]);

    const trend = toAiVisibilityTrendDto([newer, older]);

    expect(trend.map((p) => p.runAt)).toEqual([older.runAt.toISOString(), newer.runAt.toISOString()]);
  });

  it("maps each run to its scorecard percentages", () => {
    const r = run("run-1", "2026-07-01T00:00:00.000Z", ["OPEN", "OPEN", "CONTESTED", "MENTIONED"]);

    const trend = toAiVisibilityTrendDto([r]);

    expect(trend).toEqual([{ runAt: r.runAt.toISOString(), mentionedPct: 25, contestedPct: 25, openPct: 50 }]);
  });

  it("returns an empty array for no runs", () => {
    expect(toAiVisibilityTrendDto([])).toEqual([]);
  });
});
