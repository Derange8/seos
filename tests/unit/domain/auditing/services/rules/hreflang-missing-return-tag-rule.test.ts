import { describe, expect, it } from "vitest";
import { hreflangMissingReturnTagRule } from "@/domain/auditing/services/rules/hreflang-missing-return-tag-rule";
import { buildPage } from "../../page-builder";

describe("hreflangMissingReturnTagRule", () => {
  it("flags a page with a missing return tag", () => {
    const findings = hreflangMissingReturnTagRule.evaluate(
      buildPage({
        hreflangMissingReturnTags: [{ hreflang: "tr", url: "https://example.com/tr/" }],
      })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("technical");
    expect(findings[0]?.severity).toBe("WARNING");
    expect(findings[0]?.message).toContain("https://example.com/tr/");
    expect(findings[0]?.message).toContain("tr");
  });

  it("does not flag a page with no missing return tags", () => {
    expect(hreflangMissingReturnTagRule.evaluate(buildPage({ hreflangMissingReturnTags: [] }))).toHaveLength(0);
  });

  it("mentions every missing target in one finding", () => {
    const findings = hreflangMissingReturnTagRule.evaluate(
      buildPage({
        hreflangMissingReturnTags: [
          { hreflang: "tr", url: "https://example.com/tr/" },
          { hreflang: "de", url: "https://example.com/de/" },
        ],
      })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("https://example.com/tr/");
    expect(findings[0]?.message).toContain("https://example.com/de/");
  });
});
