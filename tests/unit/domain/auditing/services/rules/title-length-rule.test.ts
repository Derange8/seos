import { describe, expect, it } from "vitest";
import { titleLengthRule } from "@/domain/auditing/services/rules/title-length-rule";
import { buildPage } from "../../page-builder";

describe("titleLengthRule", () => {
  it("does not flag a missing title (that's missing-title-rule's job)", () => {
    expect(titleLengthRule.evaluate(buildPage({ title: null }))).toHaveLength(0);
  });

  it("flags a too-short title", () => {
    const findings = titleLengthRule.evaluate(buildPage({ title: "Short" }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("flags a too-long title", () => {
    const findings = titleLengthRule.evaluate(
      buildPage({ title: "A".repeat(80) })
    );
    expect(findings).toHaveLength(1);
  });

  it("does not flag a well-sized title", () => {
    const findings = titleLengthRule.evaluate(
      buildPage({ title: "A Well Sized Title For SEO Purposes Here" })
    );
    expect(findings).toHaveLength(0);
  });

  it("does not flag a title over 60 characters when it's made of narrow characters that render narrower on screen", () => {
    // 70 raw characters, but every character is in the "narrow" bucket
    // (text-width-estimator.ts) — estimated width is well under 60, so a
    // flat character-count check would wrongly flag this as truncatable.
    const narrowTitle = "iiiii iiiii iiiii iiiii iiiii iiiii iiiii iiiii iiiii iiiii iiii";
    expect(narrowTitle.length).toBeGreaterThan(60);

    const findings = titleLengthRule.evaluate(buildPage({ title: narrowTitle }));
    expect(findings).toHaveLength(0);
  });

  it("flags a title under 60 characters when it's made of wide characters that render wider on screen", () => {
    // 50 raw characters of all-wide characters — under the character-count
    // ceiling, but rendered wider than 60 average-width characters.
    const wideTitle = "MMMMMMMMMM MMMMMMMMMM MMMMMMMMMM MMMMMMMMMM MMMMM";
    expect(wideTitle.length).toBeLessThan(60);

    const findings = titleLengthRule.evaluate(buildPage({ title: wideTitle }));
    expect(findings).toHaveLength(1);
  });
});
