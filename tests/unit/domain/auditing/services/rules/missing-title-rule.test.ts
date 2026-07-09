import { describe, expect, it } from "vitest";
import { missingTitleRule } from "@/domain/auditing/services/rules/missing-title-rule";
import { buildPage } from "../../page-builder";

describe("missingTitleRule", () => {
  it("flags a page with no title", () => {
    const findings = missingTitleRule.evaluate(buildPage({ title: null }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("flags a page with a blank title", () => {
    const findings = missingTitleRule.evaluate(buildPage({ title: "   " }));
    expect(findings).toHaveLength(1);
  });

  it("does not flag a page with a title", () => {
    const findings = missingTitleRule.evaluate(buildPage({ title: "Home Page" }));
    expect(findings).toHaveLength(0);
  });
});
