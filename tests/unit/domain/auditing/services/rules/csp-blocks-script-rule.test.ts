import { describe, expect, it } from "vitest";
import { cspBlocksScriptRule } from "@/domain/auditing/services/rules/csp-blocks-script-rule";
import { buildPage } from "../../page-builder";

describe("cspBlocksScriptRule", () => {
  it("flags an external script origin not covered by script-src", () => {
    const findings = cspBlocksScriptRule.evaluate(
      buildPage({
        cspHeader: "default-src 'self'; script-src 'self'",
        externalScriptOrigins: ["https://www.googletagmanager.com"],
      })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe("csp-blocks-script");
    expect(findings[0]?.category).toBe("technical");
    expect(findings[0]?.severity).toBe("CRITICAL");
    expect(findings[0]?.message).toContain("https://www.googletagmanager.com");
  });

  it("does not flag an origin explicitly allowed by script-src", () => {
    const findings = cspBlocksScriptRule.evaluate(
      buildPage({
        cspHeader: "script-src 'self' https://www.googletagmanager.com",
        externalScriptOrigins: ["https://www.googletagmanager.com"],
      })
    );
    expect(findings).toHaveLength(0);
  });

  it("does not flag anything when the page has no CSP header at all", () => {
    const findings = cspBlocksScriptRule.evaluate(
      buildPage({ cspHeader: null, externalScriptOrigins: ["https://www.googletagmanager.com"] })
    );
    expect(findings).toHaveLength(0);
  });

  it("does not flag anything when the page references no external scripts", () => {
    const findings = cspBlocksScriptRule.evaluate(
      buildPage({ cspHeader: "script-src 'self'", externalScriptOrigins: [] })
    );
    expect(findings).toHaveLength(0);
  });

  it("does not flag anything when the CSP has neither script-src nor default-src", () => {
    const findings = cspBlocksScriptRule.evaluate(
      buildPage({
        cspHeader: "style-src 'self'",
        externalScriptOrigins: ["https://www.googletagmanager.com"],
      })
    );
    expect(findings).toHaveLength(0);
  });

  it("falls back to default-src when script-src is absent", () => {
    const findings = cspBlocksScriptRule.evaluate(
      buildPage({
        cspHeader: "default-src 'self'",
        externalScriptOrigins: ["https://www.googletagmanager.com"],
      })
    );
    expect(findings).toHaveLength(1);
  });

  it("lists every blocked origin, not just the first", () => {
    const findings = cspBlocksScriptRule.evaluate(
      buildPage({
        cspHeader: "script-src 'self'",
        externalScriptOrigins: ["https://www.googletagmanager.com", "https://cdn.jsdelivr.net"],
      })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("https://www.googletagmanager.com");
    expect(findings[0]?.message).toContain("https://cdn.jsdelivr.net");
  });
});
