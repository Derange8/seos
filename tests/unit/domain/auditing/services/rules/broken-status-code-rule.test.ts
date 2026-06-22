import { describe, expect, it } from "vitest";
import { brokenStatusCodeRule } from "@/domain/auditing/services/rules/broken-status-code-rule";
import { buildPage } from "../../page-builder";

describe("brokenStatusCodeRule", () => {
  it("flags a 404 page", () => {
    const findings = brokenStatusCodeRule.evaluate(buildPage({ statusCode: 404 }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("CRITICAL");
  });

  it("flags a 500 page", () => {
    expect(brokenStatusCodeRule.evaluate(buildPage({ statusCode: 500 }))).toHaveLength(1);
  });

  it("does not flag a 200 page", () => {
    expect(brokenStatusCodeRule.evaluate(buildPage({ statusCode: 200 }))).toHaveLength(0);
  });

  it("does not flag a page with no recorded status code", () => {
    expect(brokenStatusCodeRule.evaluate(buildPage({ statusCode: null }))).toHaveLength(0);
  });
});
