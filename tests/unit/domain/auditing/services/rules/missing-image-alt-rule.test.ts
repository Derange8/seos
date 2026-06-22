import { describe, expect, it } from "vitest";
import { missingImageAltRule } from "@/domain/auditing/services/rules/missing-image-alt-rule";
import { buildPage } from "../../page-builder";

describe("missingImageAltRule", () => {
  it("flags a page with images missing alt attributes", () => {
    const findings = missingImageAltRule.evaluate(buildPage({ imagesMissingAltCount: 3 }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("content");
    expect(findings[0]?.severity).toBe("WARNING");
    expect(findings[0]?.message).toContain("3");
  });

  it("does not flag a page where every image has an alt attribute", () => {
    expect(missingImageAltRule.evaluate(buildPage({ imagesMissingAltCount: 0 }))).toHaveLength(0);
  });
});
