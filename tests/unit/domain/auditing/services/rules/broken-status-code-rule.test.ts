import { describe, expect, it } from "vitest";
import { brokenStatusCodeRule } from "@/domain/auditing/services/rules/broken-status-code-rule";
import { buildPage } from "../../page-builder";

describe("brokenStatusCodeRule", () => {
  it("flags a 404 with many inbound internal links as CRITICAL", () => {
    const findings = brokenStatusCodeRule.evaluate(
      buildPage({ statusCode: 404, inboundInternalLinkCount: 5 })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("CRITICAL");
  });

  it("flags a 404 with a few inbound internal links as WARNING", () => {
    const findings = brokenStatusCodeRule.evaluate(
      buildPage({ statusCode: 404, inboundInternalLinkCount: 1 })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("WARNING");
  });

  it("flags a 404 with no inbound internal links as INFO — likely a deliberately removed page", () => {
    const findings = brokenStatusCodeRule.evaluate(
      buildPage({ statusCode: 404, inboundInternalLinkCount: 0 })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("INFO");
    expect(findings[0]?.message).toContain("no internal links point to it");
  });

  it("flags a 410 Gone as INFO regardless of inbound links — a deliberate removal signal", () => {
    const findings = brokenStatusCodeRule.evaluate(
      buildPage({ statusCode: 410, inboundInternalLinkCount: 10 })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("INFO");
  });

  it("applies the same inbound-link tiering to server errors, not just 404", () => {
    const findings = brokenStatusCodeRule.evaluate(
      buildPage({ statusCode: 500, inboundInternalLinkCount: 5 })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("CRITICAL");
  });

  it("flags a 404 that's still listed in the live sitemap.xml as CRITICAL, even with no inbound links", () => {
    const findings = brokenStatusCodeRule.evaluate(
      buildPage({ statusCode: 404, inboundInternalLinkCount: 0, isInSitemap: true })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("CRITICAL");
    expect(findings[0]?.message).toContain("still listed in the site's sitemap.xml");
  });

  it("sitemap membership overrides link-count tiering, not just adds to it", () => {
    // Only 1 inbound link (would be WARNING alone), but sitemap-listed
    // pushes it to CRITICAL — a deliberate, stronger signal wins.
    const findings = brokenStatusCodeRule.evaluate(
      buildPage({ statusCode: 404, inboundInternalLinkCount: 1, isInSitemap: true })
    );
    expect(findings[0]?.severity).toBe("CRITICAL");
  });

  it("410 stays INFO even when sitemap-listed — the deliberate-removal signal still wins", () => {
    const findings = brokenStatusCodeRule.evaluate(
      buildPage({ statusCode: 410, inboundInternalLinkCount: 5, isInSitemap: true })
    );
    expect(findings[0]?.severity).toBe("INFO");
  });

  it("falls back to link-count tiering when sitemap status is unknown (null)", () => {
    const findings = brokenStatusCodeRule.evaluate(
      buildPage({ statusCode: 404, inboundInternalLinkCount: 0, isInSitemap: null })
    );
    expect(findings[0]?.severity).toBe("INFO");
    expect(findings[0]?.message).not.toContain("sitemap.xml");
  });

  it("does not flag a 200 page", () => {
    expect(brokenStatusCodeRule.evaluate(buildPage({ statusCode: 200 }))).toHaveLength(0);
  });

  it("does not flag a page with no recorded status code", () => {
    expect(brokenStatusCodeRule.evaluate(buildPage({ statusCode: null }))).toHaveLength(0);
  });
});
