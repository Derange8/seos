import { describe, expect, it } from "vitest";
import {
  VisibilityExperiment,
  classifyOutcome,
  classifyCitationMovement,
} from "@/domain/ai-visibility/entities/visibility-experiment";

describe("classifyOutcome", () => {
  it("IMPROVED when the slot rank rises (regardless of citation)", () => {
    expect(classifyOutcome("CONTESTED", "MENTIONED")).toBe("IMPROVED");
    expect(classifyOutcome("OPEN", "MENTIONED")).toBe("IMPROVED");
    expect(classifyOutcome("CONTESTED", "OPEN")).toBe("IMPROVED");
    // A slot rise wins even if citation was lost.
    expect(classifyOutcome("CONTESTED", "MENTIONED", "LOST")).toBe("IMPROVED");
  });
  it("REGRESSED when the slot rank falls (regardless of citation)", () => {
    expect(classifyOutcome("MENTIONED", "CONTESTED")).toBe("REGRESSED");
    expect(classifyOutcome("OPEN", "CONTESTED")).toBe("REGRESSED");
    expect(classifyOutcome("MENTIONED", "CONTESTED", "GAINED")).toBe("REGRESSED");
  });
  it("UNCHANGED when slot is equal and citation didn't move", () => {
    expect(classifyOutcome("OPEN", "OPEN")).toBe("UNCHANGED");
    expect(classifyOutcome("OPEN", "OPEN", "UNCHANGED")).toBe("UNCHANGED");
    expect(classifyOutcome("OPEN", "OPEN", "NA")).toBe("UNCHANGED");
  });
  it("when the slot is flat, a citation gain/loss breaks the tie (the Faz 2 point)", () => {
    expect(classifyOutcome("OPEN", "OPEN", "GAINED")).toBe("IMPROVED");
    expect(classifyOutcome("OPEN", "OPEN", "LOST")).toBe("REGRESSED");
  });
});

describe("classifyCitationMovement", () => {
  it("GAINED when not cited at baseline but cited at outcome (both grounded)", () => {
    expect(classifyCitationMovement(true, false, true, true)).toBe("GAINED");
  });
  it("LOST when cited at baseline but not at outcome (both grounded)", () => {
    expect(classifyCitationMovement(true, true, true, false)).toBe("LOST");
  });
  it("UNCHANGED when citation is the same at both ends (both grounded)", () => {
    expect(classifyCitationMovement(true, true, true, true)).toBe("UNCHANGED");
    expect(classifyCitationMovement(true, false, true, false)).toBe("UNCHANGED");
  });
  it("NA when either end wasn't web-grounded — never a fabricated win/loss", () => {
    // parametric baseline (cited always false) → web_grounded outcome cited:
    // must NOT read as GAINED.
    expect(classifyCitationMovement(false, false, true, true)).toBe("NA");
    expect(classifyCitationMovement(true, true, false, false)).toBe("NA");
    expect(classifyCitationMovement(false, false, false, false)).toBe("NA");
  });
});

describe("VisibilityExperiment", () => {
  it("starts OPEN with no outcome", () => {
    const e = VisibilityExperiment.start("p", "q", "CONTESTED", new Date("2026-07-01"), true, false);
    expect(e.status).toBe("OPEN");
    expect(e.outcome).toBeNull();
    expect(e.citationMovement).toBeNull();
    expect(e.baselineSlot).toBe("CONTESTED");
    expect(e.baselineGrounded).toBe(true);
    expect(e.baselineCited).toBe(false);
  });

  it("resolves once with the outcome, and is idempotent", () => {
    const e = VisibilityExperiment.start("p", "q", "CONTESTED", new Date("2026-07-01"), true, false);

    e.resolve("MENTIONED", new Date("2026-07-05"), true, true);
    expect(e.status).toBe("RESOLVED");
    expect(e.outcomeSlot).toBe("MENTIONED");
    expect(e.outcome).toBe("IMPROVED");
    expect(e.citationMovement).toBe("GAINED");

    // a later probe must not overwrite the first post-action reading
    e.resolve("CONTESTED", new Date("2026-07-10"), true, false);
    expect(e.outcomeSlot).toBe("MENTIONED");
    expect(e.outcomeCited).toBe(true);
  });

  it("credits a citation gain as IMPROVED even when the mention slot is flat", () => {
    const e = VisibilityExperiment.start("p", "q", "OPEN", new Date("2026-07-01"), true, false);
    e.resolve("OPEN", new Date("2026-07-05"), true, true);
    expect(e.outcome).toBe("IMPROVED");
    expect(e.citationMovement).toBe("GAINED");
  });

  it("does not fabricate a citation win when the baseline wasn't web-grounded", () => {
    // Baseline was parametric (grounded=false), outcome web-grounded + cited.
    const e = VisibilityExperiment.start("p", "q", "OPEN", new Date("2026-07-01"), false, false);
    e.resolve("OPEN", new Date("2026-07-05"), true, true);
    expect(e.citationMovement).toBe("NA");
    expect(e.outcome).toBe("UNCHANGED");
  });
});
