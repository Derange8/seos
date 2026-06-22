import { describe, expect, it } from "vitest";
import { duplicateMetaDescriptionRule } from "@/domain/auditing/services/rules/duplicate-meta-description-rule";
import { buildPage } from "../../page-builder";

describe("duplicateMetaDescriptionRule", () => {
  it("flags a page whose meta description duplicates another page's", () => {
    const findings = duplicateMetaDescriptionRule.evaluate(buildPage({ hasDuplicateMetaDescription: true }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("content");
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("does not flag a page with a unique meta description", () => {
    expect(duplicateMetaDescriptionRule.evaluate(buildPage({ hasDuplicateMetaDescription: false }))).toHaveLength(0);
  });
});
