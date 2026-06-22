import { describe, expect, it } from "vitest";
import { duplicateTitleRule } from "@/domain/auditing/services/rules/duplicate-title-rule";
import { buildPage } from "../../page-builder";

describe("duplicateTitleRule", () => {
  it("flags a page whose title duplicates another page's", () => {
    const findings = duplicateTitleRule.evaluate(buildPage({ hasDuplicateTitle: true }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("content");
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("does not flag a page with a unique title", () => {
    expect(duplicateTitleRule.evaluate(buildPage({ hasDuplicateTitle: false }))).toHaveLength(0);
  });
});
