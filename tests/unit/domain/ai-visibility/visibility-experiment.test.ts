import { describe, expect, it } from "vitest";
import { VisibilityExperiment, classifyOutcome } from "@/domain/ai-visibility/entities/visibility-experiment";

describe("classifyOutcome", () => {
  it("IMPROVED when the slot rank rises", () => {
    expect(classifyOutcome("CONTESTED", "MENTIONED")).toBe("IMPROVED");
    expect(classifyOutcome("OPEN", "MENTIONED")).toBe("IMPROVED");
    expect(classifyOutcome("CONTESTED", "OPEN")).toBe("IMPROVED");
  });
  it("REGRESSED when the slot rank falls", () => {
    expect(classifyOutcome("MENTIONED", "CONTESTED")).toBe("REGRESSED");
    expect(classifyOutcome("OPEN", "CONTESTED")).toBe("REGRESSED");
  });
  it("UNCHANGED when equal", () => {
    expect(classifyOutcome("OPEN", "OPEN")).toBe("UNCHANGED");
  });
});

describe("VisibilityExperiment", () => {
  it("starts OPEN with no outcome", () => {
    const e = VisibilityExperiment.start("p", "q", "CONTESTED", new Date("2026-07-01"));
    expect(e.status).toBe("OPEN");
    expect(e.outcome).toBeNull();
    expect(e.baselineSlot).toBe("CONTESTED");
  });

  it("resolves once with the outcome, and is idempotent", () => {
    const e = VisibilityExperiment.start("p", "q", "CONTESTED", new Date("2026-07-01"));

    e.resolve("MENTIONED", new Date("2026-07-05"));
    expect(e.status).toBe("RESOLVED");
    expect(e.outcomeSlot).toBe("MENTIONED");
    expect(e.outcome).toBe("IMPROVED");

    // a later probe must not overwrite the first post-action reading
    e.resolve("CONTESTED", new Date("2026-07-10"));
    expect(e.outcomeSlot).toBe("MENTIONED");
  });
});
