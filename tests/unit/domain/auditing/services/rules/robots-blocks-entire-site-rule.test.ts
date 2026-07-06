import { describe, expect, it } from "vitest";
import { robotsBlocksEntireSiteRule } from "@/domain/auditing/services/rules/robots-blocks-entire-site-rule";
import { buildPage } from "../../page-builder";

describe("robotsBlocksEntireSiteRule", () => {
  it("flags a page when the site's robots.txt blocks everything", () => {
    const findings = robotsBlocksEntireSiteRule.evaluate(buildPage({ robotsBlocksEntireSite: true }));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("technical");
    expect(findings[0]?.severity).toBe("CRITICAL");
  });

  it("does not flag a page when robots.txt doesn't block everything", () => {
    expect(robotsBlocksEntireSiteRule.evaluate(buildPage({ robotsBlocksEntireSite: false }))).toHaveLength(0);
  });
});
