import { describe, expect, it } from "vitest";
import { mixedContentRule } from "@/domain/auditing/services/rules/mixed-content-rule";
import { buildPage } from "../../page-builder";

describe("mixedContentRule", () => {
  it("flags a page that loads resources over plain HTTP", () => {
    const findings = mixedContentRule.evaluate(buildPage({ mixedContentCount: 2 }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("technical");
    expect(findings[0]?.severity).toBe("WARNING");
    expect(findings[0]?.message).toContain("2");
  });

  it("does not flag a page with no mixed content", () => {
    expect(mixedContentRule.evaluate(buildPage({ mixedContentCount: 0 }))).toHaveLength(0);
  });
});
