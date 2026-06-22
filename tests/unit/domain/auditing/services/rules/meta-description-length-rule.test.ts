import { describe, expect, it } from "vitest";
import { metaDescriptionLengthRule } from "@/domain/auditing/services/rules/meta-description-length-rule";
import { buildPage } from "../../page-builder";

describe("metaDescriptionLengthRule", () => {
  it("does not flag a missing meta description", () => {
    expect(metaDescriptionLengthRule.evaluate(buildPage({ metaDescription: null }))).toHaveLength(0);
  });

  it("flags a too-short meta description", () => {
    const findings = metaDescriptionLengthRule.evaluate(buildPage({ metaDescription: "Too short." }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("INFO");
  });

  it("flags a too-long meta description", () => {
    const findings = metaDescriptionLengthRule.evaluate(
      buildPage({ metaDescription: "A".repeat(200) })
    );
    expect(findings).toHaveLength(1);
  });

  it("does not flag a well-sized meta description", () => {
    const findings = metaDescriptionLengthRule.evaluate(
      buildPage({
        metaDescription:
          "This is a meta description that sits comfortably within the recommended length range for search snippets.",
      })
    );
    expect(findings).toHaveLength(0);
  });
});
