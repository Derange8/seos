import { describe, expect, it } from "vitest";
import { redirectChainRule } from "@/domain/auditing/services/rules/redirect-chain-rule";
import { buildPage } from "../../page-builder";

describe("redirectChainRule", () => {
  it("does not flag a direct fetch with no redirects", () => {
    expect(redirectChainRule.evaluate(buildPage({ redirectChain: [] }))).toHaveLength(0);
  });

  it("does not flag a single, normal redirect", () => {
    expect(
      redirectChainRule.evaluate(buildPage({ redirectChain: ["https://example.com/old"] }))
    ).toHaveLength(0);
  });

  it("flags a 2+ hop redirect chain", () => {
    const findings = redirectChainRule.evaluate(
      buildPage({ redirectChain: ["https://example.com/a", "https://example.com/b"] })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("technical");
    expect(findings[0]?.severity).toBe("WARNING");
    expect(findings[0]?.message).toContain("2-hop");
    expect(findings[0]?.message).toContain("https://example.com/a");
    expect(findings[0]?.message).toContain("https://example.com/b");
  });
});
