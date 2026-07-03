import { describe, expect, it } from "vitest";
import { detectCompetitors, detectMention, dominantSlot, type Slot } from "@/domain/ai-visibility/slot";

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
