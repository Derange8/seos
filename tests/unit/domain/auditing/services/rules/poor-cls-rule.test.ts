import { describe, expect, it } from "vitest";
import { poorClsRule } from "@/domain/auditing/services/rules/poor-cls-rule";
import { buildPage } from "../../page-builder";

describe("poorClsRule", () => {
  it("does not flag a page below the Good threshold (0.1)", () => {
    expect(poorClsRule.evaluate(buildPage({ cls: 0.05 }))).toHaveLength(0);
  });

  it("does not flag a page exactly at the Good threshold", () => {
    expect(poorClsRule.evaluate(buildPage({ cls: 0.1 }))).toHaveLength(0);
  });

  it("flags a page in the Needs Improvement range as WARNING", () => {
    const findings = poorClsRule.evaluate(buildPage({ cls: 0.2 }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("WARNING");
    expect(findings[0]?.category).toBe("performance");
  });

  it("flags a page above the Poor threshold (0.25) as CRITICAL", () => {
    const findings = poorClsRule.evaluate(buildPage({ cls: 0.4 }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("CRITICAL");
  });

  it("does not flag a page where CLS wasn't measured (null)", () => {
    expect(poorClsRule.evaluate(buildPage({ cls: null }))).toHaveLength(0);
  });
});
