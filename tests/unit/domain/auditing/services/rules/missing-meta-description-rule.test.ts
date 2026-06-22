import { describe, expect, it } from "vitest";
import { missingMetaDescriptionRule } from "@/domain/auditing/services/rules/missing-meta-description-rule";
import { buildPage } from "../../page-builder";

describe("missingMetaDescriptionRule", () => {
  it("flags a page with no meta description", () => {
    const findings = missingMetaDescriptionRule.evaluate(buildPage({ metaDescription: null }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("does not flag a page with a meta description", () => {
    const findings = missingMetaDescriptionRule.evaluate(
      buildPage({ metaDescription: "A description." })
    );
    expect(findings).toHaveLength(0);
  });
});
