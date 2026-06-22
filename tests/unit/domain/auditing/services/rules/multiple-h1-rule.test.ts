import { describe, expect, it } from "vitest";
import { multipleH1Rule } from "@/domain/auditing/services/rules/multiple-h1-rule";
import { buildPage } from "../../page-builder";

describe("multipleH1Rule", () => {
  it("does not flag a page with exactly one h1", () => {
    expect(multipleH1Rule.evaluate(buildPage({ h1Count: 1 }))).toHaveLength(0);
  });

  it("does not flag a page with zero h1s (missing-h1-rule's job)", () => {
    expect(multipleH1Rule.evaluate(buildPage({ h1Count: 0 }))).toHaveLength(0);
  });

  it("flags a page with 2+ h1s", () => {
    const findings = multipleH1Rule.evaluate(buildPage({ h1Count: 3 }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("content");
    expect(findings[0]?.severity).toBe("WARNING");
    expect(findings[0]?.message).toContain("3");
  });
});
