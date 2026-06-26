import { describe, expect, it } from "vitest";
import { estimateTextWidth } from "@/domain/auditing/services/text-width-estimator";

describe("estimateTextWidth", () => {
  it("returns roughly the character count for an average mixed-case sentence", () => {
    const text = "A Decent Example Of Average Width Text";
    const width = estimateTextWidth(text);
    expect(width).toBeGreaterThan(text.length * 0.8);
    expect(width).toBeLessThan(text.length * 1.6);
  });

  it("estimates a string of narrow characters as narrower than its character count", () => {
    const narrow = "iiiiiiiiiiiiiiiiiiiiiiiiiiiiii"; // 30 chars
    expect(estimateTextWidth(narrow)).toBeLessThan(narrow.length);
  });

  it("estimates a string of wide characters as wider than its character count", () => {
    const wide = "MMMMMMMM"; // 8 chars
    expect(estimateTextWidth(wide)).toBeGreaterThan(wide.length);
  });

  it("returns 0 for an empty string", () => {
    expect(estimateTextWidth("")).toBe(0);
  });
});
