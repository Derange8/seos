import { describe, expect, it } from "vitest";
import { unrecognizedStructuredDataTypeRule } from "@/domain/auditing/services/rules/unrecognized-structured-data-type-rule";
import { buildPage } from "../../page-builder";

describe("unrecognizedStructuredDataTypeRule", () => {
  it("flags a page with an unrecognized @type", () => {
    const findings = unrecognizedStructuredDataTypeRule.evaluate(
      buildPage({ structuredDataTypes: ["Artical"] })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("structured_data");
    expect(findings[0]?.severity).toBe("INFO");
    expect(findings[0]?.message).toContain("Artical");
  });

  it("does not flag known schema.org types", () => {
    const findings = unrecognizedStructuredDataTypeRule.evaluate(
      buildPage({ structuredDataTypes: ["Organization", "BreadcrumbList"] })
    );
    expect(findings).toHaveLength(0);
  });

  it("does not flag a full URI or CURIE type reference", () => {
    const findings = unrecognizedStructuredDataTypeRule.evaluate(
      buildPage({ structuredDataTypes: ["https://schema.org/Organization"] })
    );
    expect(findings).toHaveLength(0);
  });

  it("does not flag a page with no structured data at all", () => {
    expect(unrecognizedStructuredDataTypeRule.evaluate(buildPage({ structuredDataTypes: [] }))).toHaveLength(0);
  });

  it("reports only one finding even with multiple unrecognized types", () => {
    const findings = unrecognizedStructuredDataTypeRule.evaluate(
      buildPage({ structuredDataTypes: ["Artical", "Bloog"] })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("Artical");
    expect(findings[0]?.message).toContain("Bloog");
  });
});
