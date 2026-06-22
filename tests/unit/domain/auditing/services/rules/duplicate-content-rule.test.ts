import { describe, expect, it } from "vitest";
import { duplicateContentRule } from "@/domain/auditing/services/rules/duplicate-content-rule";
import { buildPage } from "../../page-builder";

describe("duplicateContentRule", () => {
  it("flags a page whose visible content duplicates another page's", () => {
    const findings = duplicateContentRule.evaluate(buildPage({ hasDuplicateContent: true }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("content");
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("does not flag a page with unique content", () => {
    expect(duplicateContentRule.evaluate(buildPage({ hasDuplicateContent: false }))).toHaveLength(0);
  });
});
