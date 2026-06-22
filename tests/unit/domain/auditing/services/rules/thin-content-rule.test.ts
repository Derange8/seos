import { describe, expect, it } from "vitest";
import { thinContentRule } from "@/domain/auditing/services/rules/thin-content-rule";
import { buildPage } from "../../page-builder";

describe("thinContentRule", () => {
  it("flags a page below the word-count threshold", () => {
    const findings = thinContentRule.evaluate(buildPage({ wordCount: 120 }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("does not flag a page with enough content", () => {
    expect(thinContentRule.evaluate(buildPage({ wordCount: 500 }))).toHaveLength(0);
  });

  it("does not flag a page where word count could not be determined", () => {
    expect(thinContentRule.evaluate(buildPage({ wordCount: null }))).toHaveLength(0);
  });
});
