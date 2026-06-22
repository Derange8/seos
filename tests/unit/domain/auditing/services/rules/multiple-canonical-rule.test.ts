import { describe, expect, it } from "vitest";
import { multipleCanonicalRule } from "@/domain/auditing/services/rules/multiple-canonical-rule";
import { buildPage } from "../../page-builder";

describe("multipleCanonicalRule", () => {
  it("does not flag a page with exactly one canonical tag", () => {
    expect(multipleCanonicalRule.evaluate(buildPage({ canonicalTagCount: 1 }))).toHaveLength(0);
  });

  it("does not flag a page with zero canonical tags (missing-canonical-rule's job)", () => {
    expect(multipleCanonicalRule.evaluate(buildPage({ canonicalTagCount: 0 }))).toHaveLength(0);
  });

  it("flags a page with 2+ canonical tags", () => {
    const findings = multipleCanonicalRule.evaluate(buildPage({ canonicalTagCount: 2 }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("technical");
    expect(findings[0]?.severity).toBe("WARNING");
  });
});
