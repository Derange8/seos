import { describe, expect, it } from "vitest";
import { formatAiVisibilityReport } from "@/lib/format-ai-visibility-report";
import type {
  AiVisibilityRunDto,
  AiVisibilityTrendPointDto,
  VisibilityExperimentDto,
} from "@/application/ai-visibility/dto";
import type { AiVisibilityScorecard } from "@/domain/ai-visibility/services/scorecard";

function scorecard(overrides: Partial<AiVisibilityScorecard> = {}): AiVisibilityScorecard {
  return {
    totalSamples: 8,
    mentioned: 2,
    contested: 3,
    open: 3,
    mentionedPct: 25,
    contestedPct: 38,
    openPct: 38,
    citedSamples: 2,
    citedPct: 25,
    competitorFrequency: [{ name: "Polymarket", queryCount: 2 }],
    winnableQueries: ["best prediction market"],
    lowConfidenceQueries: [],
    ...overrides,
  };
}

function run(overrides: Partial<AiVisibilityRunDto> = {}): AiVisibilityRunDto {
  return {
    runAt: "2026-07-05T10:00:00.000Z",
    samplesPerQuery: 2,
    groundingMode: "web_grounded",
    engine: "openai",
    scorecard: scorecard(),
    queries: [
      {
        query: "best prediction market",
        dominantSlot: "OPEN",
        mentioned: 0,
        contested: 0,
        open: 2,
        competitorsMentioned: [],
        citedSamples: 1,
        citations: [{ url: "https://acme.com/x" }],
        consensus: 1,
        confident: true,
      },
    ],
    delta: null,
    ...overrides,
  };
}

const experiment = (o: Partial<VisibilityExperimentDto> = {}): VisibilityExperimentDto => ({
  id: "e1",
  query: "best prediction market",
  baselineSlot: "OPEN",
  actionAt: "2026-07-01T00:00:00.000Z",
  status: "RESOLVED",
  outcomeSlot: "OPEN",
  outcome: "IMPROVED",
  citationMovement: "GAINED",
  ...o,
});

describe("formatAiVisibilityReport", () => {
  it("includes the domain, engine, measurement mode, and scorecard", () => {
    const report = formatAiVisibilityReport("acme.com", run(), [], []);
    expect(report).toContain("Seos AI Visibility Report — acme.com");
    expect(report).toContain("Engine: ChatGPT (OpenAI)");
    expect(report).toContain("live web search");
    expect(report).toContain("Recommended (mentioned): 25%");
    expect(report).toContain("Cited (your domain in AI-search sources): 25%");
  });

  it("labels a different engine and says the delta isn't comparable across engines", () => {
    const report = formatAiVisibilityReport(
      "acme.com",
      run({
        engine: "anthropic",
        delta: {
          previousRunAt: "2026-07-01T00:00:00.000Z",
          mentionedPctDelta: 0,
          openPctDelta: 0,
          contestedPctDelta: 0,
          citedPctDelta: 0,
          citedComparable: false,
          sameEngine: false,
          changes: [],
        },
      }),
      [],
      []
    );
    expect(report).toContain("Engine: Claude (Anthropic)");
    expect(report).toContain("Not comparable — the previous run was measured on a different engine.");
  });

  it("reports citation as not measured for a parametric run (never a fake 0%)", () => {
    const report = formatAiVisibilityReport(
      "acme.com",
      run({ groundingMode: "parametric", scorecard: scorecard({ citedPct: 0 }) }),
      [],
      []
    );
    expect(report).toContain("model memory only");
    expect(report).toContain("not measured (memory-only run)");
    expect(report).not.toContain("Cited (your domain in AI-search sources): 0%");
  });

  it("includes the since-last-run delta with a cited movement on a grounded run", () => {
    const report = formatAiVisibilityReport(
      "acme.com",
      run({
        delta: {
          previousRunAt: "2026-07-01T00:00:00.000Z",
          mentionedPctDelta: 25,
          openPctDelta: -25,
          contestedPctDelta: 0,
          citedPctDelta: 25,
          citedComparable: true,
          sameEngine: true,
          changes: [],
        },
      }),
      [],
      []
    );
    expect(report).toContain("SINCE LAST RUN");
    expect(report).toContain("Mentioned +25%");
    expect(report).toContain("Cited +25%");
  });

  it("omits the cited delta line for a parametric run", () => {
    const report = formatAiVisibilityReport(
      "acme.com",
      run({
        groundingMode: "parametric",
        delta: {
          previousRunAt: "2026-07-01T00:00:00.000Z",
          mentionedPctDelta: 10,
          openPctDelta: -10,
          contestedPctDelta: 0,
          citedPctDelta: 0,
          citedComparable: false,
          sameEngine: true,
          changes: [],
        },
      }),
      [],
      []
    );
    expect(report).toContain("SINCE LAST RUN");
    expect(report).not.toContain("Cited +0%");
  });

  it("omits the cited delta on a web-grounded run when the previous run wasn't comparable", () => {
    // The reviewed bug: current run is web_grounded but the baseline was
    // parametric, so citedComparable is false and citedPctDelta was forced to
    // 0 — the report must NOT print a (fabricated) cited movement.
    const report = formatAiVisibilityReport(
      "acme.com",
      run({
        groundingMode: "web_grounded",
        delta: {
          previousRunAt: "2026-07-01T00:00:00.000Z",
          mentionedPctDelta: 0,
          openPctDelta: 0,
          contestedPctDelta: 0,
          citedPctDelta: 0,
          citedComparable: false,
          sameEngine: true,
          changes: [],
        },
      }),
      [],
      []
    );
    // The SCORECARD still legitimately shows "Cited (...)" for this grounded
    // run; what must be absent is a cited MOVEMENT line in the delta section.
    const sinceSection = report.slice(report.indexOf("SINCE LAST RUN"));
    expect(report).toContain("SINCE LAST RUN");
    expect(sinceSection).not.toContain("Cited");
  });

  it("lists winnable queries and dominating competitors", () => {
    const report = formatAiVisibilityReport("acme.com", run(), [], []);
    expect(report).toContain("WINNABLE QUERIES");
    expect(report).toContain("• best prediction market");
    expect(report).toContain("COMPETITORS AI RECOMMENDS INSTEAD");
    expect(report).toContain("• Polymarket (2 queries)");
  });

  it("lists low-consensus queries in an UNCERTAIN section", () => {
    const report = formatAiVisibilityReport(
      "acme.com",
      run({ scorecard: scorecard({ lowConfidenceQueries: ["is it safe", "does it work"] }) }),
      [],
      []
    );
    expect(report).toContain("UNCERTAIN QUERIES");
    expect(report).toContain("• is it safe");
    expect(report).toContain("• does it work");
  });

  it("renders resolved before/after experiments, flagging a citation gain", () => {
    const report = formatAiVisibilityReport("acme.com", run(), [], [experiment()]);
    expect(report).toContain("BEFORE / AFTER");
    expect(report).toContain('"best prediction market": IMPROVED (OPEN → OPEN · now cited in sources 🔗)');
  });

  it("omits the before/after section when there are no resolved experiments", () => {
    const report = formatAiVisibilityReport("acme.com", run(), [], [experiment({ status: "OPEN", outcome: null })]);
    expect(report).not.toContain("BEFORE / AFTER");
  });

  it("truncates a long winnable-query list with a summary line", () => {
    const many = Array.from({ length: 12 }, (_, i) => `query ${i + 1}`);
    const report = formatAiVisibilityReport(
      "acme.com",
      run({ scorecard: scorecard({ winnableQueries: many }) }),
      [],
      []
    );
    expect(report).toContain("…and 4 more");
  });
});
