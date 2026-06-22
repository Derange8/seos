import { describe, expect, it } from "vitest";
import { missingH1Rule } from "@/domain/auditing/services/rules/missing-h1-rule";
import { buildPage } from "../../page-builder";

describe("missingH1Rule", () => {
  it("flags a page with no h1", () => {
    const findings = missingH1Rule.evaluate(buildPage({ h1: null }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("does not flag a page with an h1", () => {
    expect(missingH1Rule.evaluate(buildPage({ h1: "Welcome" }))).toHaveLength(0);
  });
});
