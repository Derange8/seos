import { describe, expect, it } from "vitest";
import { clientSideOnlyContentRule } from "@/domain/auditing/services/rules/client-side-only-content-rule";
import { buildPage } from "../../page-builder";

describe("clientSideOnlyContentRule", () => {
  it("flags a page whose real content only exists after client-side JS runs", () => {
    const findings = clientSideOnlyContentRule.evaluate(
      buildPage({ isClientSideOnlyContent: true, rawWordCount: 5, wordCount: 400 })
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("technical");
    expect(findings[0]?.severity).toBe("WARNING");
    expect(findings[0]?.message).toContain("5 words");
    expect(findings[0]?.message).toContain("400 words");
  });

  it("does not flag a page that was not measured for client-side-only content (deepCsrCheck off)", () => {
    expect(clientSideOnlyContentRule.evaluate(buildPage({ isClientSideOnlyContent: false }))).toHaveLength(0);
  });
});
