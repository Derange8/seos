import { describe, expect, it } from "vitest";
import { poorLcpRule } from "@/domain/auditing/services/rules/poor-lcp-rule";
import { buildPage } from "../../page-builder";

describe("poorLcpRule", () => {
  it("does not flag a page below the Good threshold (2500ms)", () => {
    expect(poorLcpRule.evaluate(buildPage({ lcpMs: 2000 }))).toHaveLength(0);
  });

  it("does not flag a page exactly at the Good threshold", () => {
    expect(poorLcpRule.evaluate(buildPage({ lcpMs: 2500 }))).toHaveLength(0);
  });

  it("flags a page in the Needs Improvement range as WARNING", () => {
    const findings = poorLcpRule.evaluate(buildPage({ lcpMs: 3000 }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("WARNING");
    expect(findings[0]?.category).toBe("performance");
  });

  it("flags a page above the Poor threshold (4000ms) as CRITICAL", () => {
    const findings = poorLcpRule.evaluate(buildPage({ lcpMs: 5000 }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("CRITICAL");
  });

  it("does not flag a page where LCP wasn't measured (null)", () => {
    expect(poorLcpRule.evaluate(buildPage({ lcpMs: null }))).toHaveLength(0);
  });
});
