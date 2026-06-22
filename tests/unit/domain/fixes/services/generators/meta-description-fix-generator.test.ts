import { describe, expect, it } from "vitest";
import { metaDescriptionFixGenerator } from "@/domain/fixes/services/generators/meta-description-fix-generator";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function issue(): AuditIssue {
  return AuditIssue.create("run-1", "page-1", {
    ruleId: "missing-meta-description",
    category: "content",
    severity: "WARNING",
    message: "msg",
  });
}

describe("metaDescriptionFixGenerator", () => {
  it("uses a long-enough content excerpt as-is", () => {
    const excerpt = "A".repeat(90);
    const page = Page.create("job-1", url("https://example.com/"), { contentExcerpt: excerpt });
    const candidate = metaDescriptionFixGenerator.generate(page, issue());
    expect(candidate?.content).toBe(excerpt);
    expect(candidate?.type).toBe("META_DESCRIPTION");
  });

  it("pads a short-but-real excerpt rather than discarding it", () => {
    const page = Page.create("job-1", url("https://example.com/"), { contentExcerpt: "Short excerpt." });
    const candidate = metaDescriptionFixGenerator.generate(page, issue());
    expect(candidate?.content).toContain("Short excerpt.");
    expect(candidate?.content).toContain("example.com");
  });

  it("falls back to a generic templated line when there is no excerpt at all", () => {
    const page = Page.create("job-1", url("https://example.com/"), { h1: "Our Product" });
    const candidate = metaDescriptionFixGenerator.generate(page, issue());
    expect(candidate?.content).toContain("Our Product");
    expect(candidate?.content).toContain("example.com");
  });

  it("truncates an overly long excerpt at a word boundary", () => {
    const excerpt = "word ".repeat(50).trim();
    const page = Page.create("job-1", url("https://example.com/"), { contentExcerpt: excerpt });
    const candidate = metaDescriptionFixGenerator.generate(page, issue());
    expect(candidate?.content.length).toBeLessThanOrEqual(160);
  });
});
