import { describe, expect, it } from "vitest";
import { missingCanonicalRule } from "@/domain/auditing/services/rules/missing-canonical-rule";
import { buildPage } from "../../page-builder";

describe("missingCanonicalRule", () => {
  it("flags a page with no canonical URL", () => {
    const findings = missingCanonicalRule.evaluate(buildPage({ canonicalUrl: null }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("INFO");
  });

  it("does not flag a page with a canonical URL", () => {
    expect(
      missingCanonicalRule.evaluate(buildPage({ canonicalUrl: "https://example.com/" }))
    ).toHaveLength(0);
  });
});
