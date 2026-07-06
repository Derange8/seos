import { describe, expect, it } from "vitest";
import { invalidStructuredDataRule } from "@/domain/auditing/services/rules/invalid-structured-data-rule";
import { buildPage } from "../../page-builder";

describe("invalidStructuredDataRule", () => {
  it("flags a page with a malformed JSON-LD block", () => {
    const findings = invalidStructuredDataRule.evaluate(buildPage({ hasInvalidStructuredData: true }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("structured_data");
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("does not flag a page with no invalid structured data", () => {
    expect(invalidStructuredDataRule.evaluate(buildPage({ hasInvalidStructuredData: false }))).toHaveLength(0);
  });
});
