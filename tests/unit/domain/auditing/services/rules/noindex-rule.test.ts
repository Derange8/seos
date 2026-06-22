import { describe, expect, it } from "vitest";
import { noindexRule } from "@/domain/auditing/services/rules/noindex-rule";
import { buildPage } from "../../page-builder";

describe("noindexRule", () => {
  it("flags a noindexed page as INFO, not a higher severity", () => {
    const findings = noindexRule.evaluate(buildPage({ isNoindex: true }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("technical");
    expect(findings[0]?.severity).toBe("INFO");
  });

  it("does not flag a normal, indexable page", () => {
    expect(noindexRule.evaluate(buildPage({ isNoindex: false }))).toHaveLength(0);
  });
});
