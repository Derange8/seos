import { describe, expect, it } from "vitest";
import { titleLengthRule } from "@/domain/auditing/services/rules/title-length-rule";
import { buildPage } from "../../page-builder";

describe("titleLengthRule", () => {
  it("does not flag a missing title (that's missing-title-rule's job)", () => {
    expect(titleLengthRule.evaluate(buildPage({ title: null }))).toHaveLength(0);
  });

  it("flags a too-short title", () => {
    const findings = titleLengthRule.evaluate(buildPage({ title: "Short" }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("flags a too-long title", () => {
    const findings = titleLengthRule.evaluate(
      buildPage({ title: "A".repeat(80) })
    );
    expect(findings).toHaveLength(1);
  });

  it("does not flag a well-sized title", () => {
    const findings = titleLengthRule.evaluate(
      buildPage({ title: "A Well Sized Title For SEO Purposes Here" })
    );
    expect(findings).toHaveLength(0);
  });
});
