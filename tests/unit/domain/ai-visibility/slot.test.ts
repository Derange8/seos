import { describe, expect, it } from "vitest";
import {
  detectCompetitors,
  detectMention,
  dominantSlot,
  slotConsensus,
  isConfident,
  CONFIDENCE_THRESHOLD,
  type Slot,
} from "@/domain/ai-visibility/slot";

describe("detectMention", () => {
  it("matches any alias case-insensitively", () => {
    expect(detectMention("Denerseniz JANUS.VOTE harika", ["janus", "janus.vote"])).toBe(true);
  });
  it("is false when no alias appears", () => {
    expect(detectMention("Polymarket ve Augur önerilir", ["janus", "janus.vote"])).toBe(false);
  });
});

describe("detectCompetitors", () => {
  it("returns the subset of competitors present, case-insensitive", () => {
    expect(detectCompetitors("Try POLYMARKET or manifold", ["Polymarket", "Augur", "Manifold"])).toEqual([
      "Polymarket",
      "Manifold",
    ]);
  });
  it("returns empty when none appear", () => {
    expect(detectCompetitors("generic answer", ["Polymarket"])).toEqual([]);
  });
});

describe("dominantSlot", () => {
  it("returns the plurality slot", () => {
    const slots: Slot[] = ["OPEN", "OPEN", "CONTESTED"];
    expect(dominantSlot(slots)).toBe("OPEN");
  });
  it("lets MENTIONED win a tie — any self-mention is the strongest signal", () => {
    const slots: Slot[] = ["MENTIONED", "CONTESTED"];
    expect(dominantSlot(slots)).toBe("MENTIONED");
  });
  it("breaks an OPEN/CONTESTED tie toward CONTESTED (conservative)", () => {
    const slots: Slot[] = ["OPEN", "CONTESTED"];
    expect(dominantSlot(slots)).toBe("CONTESTED");
  });
  it("returns OPEN when all samples are open", () => {
    expect(dominantSlot(["OPEN", "OPEN", "OPEN"])).toBe("OPEN");
  });
});

describe("slotConsensus", () => {
  it("is the share of samples in the dominant slot", () => {
    expect(slotConsensus(["OPEN", "OPEN", "OPEN", "CONTESTED"])).toBe(0.75); // 3/4 OPEN
  });
  it("is 1 when all samples agree", () => {
    expect(slotConsensus(["OPEN", "OPEN"])).toBe(1);
  });
  it("counts the dominant slot even on a MENTIONED tie", () => {
    // dominantSlot picks MENTIONED on a 1/1 tie; consensus is that slot's share.
    expect(slotConsensus(["MENTIONED", "CONTESTED"])).toBe(0.5);
  });
  it("is 0 for no samples", () => {
    expect(slotConsensus([])).toBe(0);
  });
});

describe("isConfident", () => {
  it("is true at or above the threshold", () => {
    expect(isConfident(["OPEN", "OPEN", "OPEN"])).toBe(true); // 1.0
    expect(isConfident(["OPEN", "OPEN", "OPEN", "CONTESTED", "MENTIONED"])).toBe(CONFIDENCE_THRESHOLD <= 0.6); // 3/5 = 0.6
  });
  it("is false below the threshold", () => {
    // 2/5 OPEN plurality → 0.4 consensus, under 0.6.
    expect(isConfident(["OPEN", "OPEN", "CONTESTED", "MENTIONED", "CONTESTED"])).toBe(false);
  });
  it("is false for no samples", () => {
    expect(isConfident([])).toBe(false);
  });
});
