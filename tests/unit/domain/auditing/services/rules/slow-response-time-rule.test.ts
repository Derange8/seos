import { describe, expect, it } from "vitest";
import { slowResponseTimeRule } from "@/domain/auditing/services/rules/slow-response-time-rule";
import { buildPage } from "../../page-builder";

describe("slowResponseTimeRule", () => {
  it("flags a page that took 2000ms or more to respond", () => {
    const findings = slowResponseTimeRule.evaluate(buildPage({ responseTimeMs: 2500 }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("performance");
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("does not flag a fast page", () => {
    expect(slowResponseTimeRule.evaluate(buildPage({ responseTimeMs: 300 }))).toHaveLength(0);
  });

  it("does not flag a page with no recorded response time", () => {
    expect(slowResponseTimeRule.evaluate(buildPage({ responseTimeMs: null }))).toHaveLength(0);
  });
});
