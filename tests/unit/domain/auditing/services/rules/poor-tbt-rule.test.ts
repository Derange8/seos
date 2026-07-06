import { describe, expect, it } from "vitest";
import { poorTbtRule } from "@/domain/auditing/services/rules/poor-tbt-rule";
import { buildPage } from "../../page-builder";

describe("poorTbtRule", () => {
  it("does not flag a page below the fast threshold (200ms)", () => {
    expect(poorTbtRule.evaluate(buildPage({ tbtMs: 100 }))).toHaveLength(0);
  });

  it("does not flag a page exactly at the fast threshold", () => {
    expect(poorTbtRule.evaluate(buildPage({ tbtMs: 200 }))).toHaveLength(0);
  });

  it("flags a page in the moderate range as WARNING", () => {
    const findings = poorTbtRule.evaluate(buildPage({ tbtMs: 400 }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("WARNING");
    expect(findings[0]?.category).toBe("performance");
  });

  it("flags a page above the slow threshold (600ms) as CRITICAL", () => {
    const findings = poorTbtRule.evaluate(buildPage({ tbtMs: 800 }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("CRITICAL");
  });

  it("does not flag a page where TBT wasn't measured (null)", () => {
    expect(poorTbtRule.evaluate(buildPage({ tbtMs: null }))).toHaveLength(0);
  });
});
