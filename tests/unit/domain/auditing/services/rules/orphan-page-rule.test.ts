import { describe, expect, it } from "vitest";
import { orphanPageRule } from "@/domain/auditing/services/rules/orphan-page-rule";
import { buildPage } from "../../page-builder";

describe("orphanPageRule", () => {
  it("flags a page with no internal links pointing to it", () => {
    const findings = orphanPageRule.evaluate(buildPage({ isOrphan: true }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("technical");
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("does not flag a page with incoming internal links", () => {
    expect(orphanPageRule.evaluate(buildPage({ isOrphan: false }))).toHaveLength(0);
  });
});
