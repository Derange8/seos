import { describe, expect, it } from "vitest";
import { missingStructuredDataRule } from "@/domain/auditing/services/rules/missing-structured-data-rule";
import { buildPage } from "../../page-builder";

describe("missingStructuredDataRule", () => {
  it("flags a page with no structured data", () => {
    const findings = missingStructuredDataRule.evaluate(buildPage({ hasStructuredData: false }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("structured_data");
    expect(findings[0]?.severity).toBe("INFO");
  });

  it("does not flag a page that already has structured data", () => {
    expect(missingStructuredDataRule.evaluate(buildPage({ hasStructuredData: true }))).toHaveLength(0);
  });
});
